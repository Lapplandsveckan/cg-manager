import {should, suite, test} from '../../utility';
import {CgCommand} from '../../../src';
import {expect} from 'chai';
import {noTry} from 'no-try';

should;

// ---------------------------------------------------------------------------
// Simulated CasparCG pipeline
// Reproduces the two stages between our wire bytes and the template's update()
// ---------------------------------------------------------------------------

/**
 * Stage 1: port of IO::tokenize (tokenize.cpp).
 * On `\`: consume next char — `\\`→`\`, `\"`→`"`, `\n`→newline, anything else → both dropped.
 * Bare `"` toggles quoting and is removed. Space outside quotes splits tokens.
 */
function tokenize(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote = false;
    let i = 0;

    while (i < line.length) {
        const ch = line[i];

        if (ch === '\\' && i + 1 < line.length) {
            const next = line[i + 1];
            if (next === '\\') { current += '\\'; i += 2; continue; }
            if (next === '"')  { current += '"';  i += 2; continue; }
            if (next === 'n')  { current += '\n'; i += 2; continue; }
            // any other \x → both chars dropped (matches Caspar default: break)
            i += 2;
            continue;
        }

        if (ch === '"') { inQuote = !inQuote; i++; continue; }

        if (ch === ' ' && !inQuote) {
            if (current.length > 0) { tokens.push(current); current = ''; }
            i++;
            continue;
        }

        current += ch;
        i++;
    }

    if (current.length > 0) tokens.push(current);
    return tokens;
}

/**
 * Stage 2: port of html_cg_proxy::update (html_cg_proxy.cpp).
 * Trims leading/trailing spaces and `"`, escapes `"` → `\"`, wraps in `update("…")`.
 * Backslashes are NOT escaped — that is the Caspar bug this fix compensates for.
 */
function htmlCgProxy(data: string): string {
    const trimmed = data.replace(/^[ "]+|[ "]+$/g, '');
    const escaped = trimmed.replace(/"/g, '\\"');
    return `update("${escaped}")`;
}

/**
 * Runs the full CasparCG pipeline: Stage 1 tokenize → Stage 2 html_cg_proxy → browser eval.
 * Returns the string the template's update() receives, or throws on a malformed JS literal.
 */
function runCasparPipeline(amcpLine: string): string {
    const argLine = amcpLine.replace(/^CG /, '').replace(/\r\n$/, '');
    const tokens = tokenize(argLine);
    const dataToken = tokens[tokens.length - 1];
    const jsSrc = htmlCgProxy(dataToken);

    let received: string | undefined;
    const fn = new Function('update', jsSrc); // throws here if the JS literal is malformed
    fn((s: string) => { received = s; });

    if (received === undefined) throw new Error('update() was never called');
    return received;
}

/**
 * Builds the AMCP command line for a CG UPDATE with a pluggable data serializer,
 * mirroring exactly what CgCommand.update + compileArgs produces.
 * Lets us compare the fixed and unfixed serialization paths through the same pipeline.
 */
function buildUpdateLine(data: object, serialize: (d: object) => string): string {
    const serialized = serialize(data);
    // Mirrors compileArgs: JSON.stringify the arg, strip outer quotes only when no spaces.
    const encoded = JSON.stringify(serialized);
    const arg = encoded.includes(' ') ? encoded : encoded.slice(1, -1);
    return `CG 1-1 UPDATE 1 ${arg}\r\n`;
}

const fixedSerialize = (d: object) => JSON.stringify(d).replace(/\\/g, '\\\\');
const brokenSerialize = (d: object) => JSON.stringify(d); // old behaviour, no backslash doubling

// ---------------------------------------------------------------------------

const CASES: Array<{ label: string; data: object }> = [
    {
        label: 'plain object (no special chars)',
        data: {text: 'hello', value: 42},
    },
    {
        label: 'value containing double-quote (the reported bug)',
        data: {text: 'say "hi"'},
    },
    {
        label: 'value containing backslash (Windows path)',
        data: {path: 'C:\\temp\\file.txt'},
    },
    {
        label: 'value containing newline and tab',
        data: {text: 'line1\nline2\ttabbed'},
    },
    {
        label: 'value containing spaces (quoted token path)',
        data: {text: 'hello world from caspar'},
    },
    {
        label: 'nested object with mixed specials',
        data: {outer: {inner: 'a "quoted" value'}, path: 'C:\\dir', list: [1, 'two', 'thr"ee']},
    },
];

@suite class CgCommandUnitTests {
    @test 'serializeData round-trips through simulated CasparCG pipeline — update'() {
        for (const {label, data} of CASES) {
            const [err, received] = noTry(() => runCasparPipeline(
                CgCommand.update(data).allocate(1, 1).getCommand()!
            ));
            if (err) throw new Error(`CG UPDATE case "${label}" threw: ${err}`);
            expect(JSON.parse(received!), `CG UPDATE case: ${label}`).to.deep.equal(data);
        }
    }

    @test 'serializeData round-trips through simulated CasparCG pipeline — add'() {
        for (const {label, data} of CASES) {
            const [err, received] = noTry(() => runCasparPipeline(
                CgCommand.add('mytemplate', true, data).allocate(1, 1).getCommand()!
            ));
            if (err) throw new Error(`CG ADD case "${label}" threw: ${err}`);
            expect(JSON.parse(received!), `CG ADD case: ${label}`).to.deep.equal(data);
        }
    }

    @test 'without fix, double-quote in value produces a malformed JS literal'() {
        const data = {text: 'say "hi"'};
        // Unfixed path (bare JSON.stringify, no backslash doubling) → full pipeline → SyntaxError
        const [unfixedErr] = noTry(() => runCasparPipeline(buildUpdateLine(data, brokenSerialize)));
        expect(unfixedErr, 'unfixed payload should produce a SyntaxError').to.exist;

        // Fixed path → same pipeline → round-trips correctly
        const [fixedErr, received] = noTry(() => runCasparPipeline(buildUpdateLine(data, fixedSerialize)));
        expect(fixedErr, 'fixed payload should not throw').to.not.exist;
        expect(JSON.parse(received!)).to.deep.equal(data);
    }
}
