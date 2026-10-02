import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import config, { loadConfigQuiet } from '../util/config';
import { schema, getPath, hasPath, setPath } from '../util/configSchema';

function printUsage() {
    console.log(`Usage: manager config <command>

Commands:
  show              Print the effective config (secret values redacted)
  get <key>         Print the current value of one key
  set <key> <val>   Write a value into config.json (use null to clear)
  keys              List all keys with their type, default, and description
`);
}

function fail(message: string): never {
    console.error(`Error: ${message}`);
    process.exit(1);
}

function parseNumber(raw: string) {
    const n = Number(raw);
    if (Number.isNaN(n)) fail(`"${raw}" is not a valid number.`);
    return n;
}

function parseBoolean(raw: string) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return fail(`"${raw}" is not a valid boolean. Use true or false.`);
}

const parsers: Record<string, (raw: string) => string | number | boolean> = {
    number: parseNumber,
    boolean: parseBoolean,
};

function coerce(raw: string, type: string) {
    if (raw === 'null') return null;
    return (parsers[type] ?? (value => value))(raw);
}

export async function runConfigCli(args: string[]): Promise<void> {
    if (process.env.CASPAR_DIR) process.chdir(process.env.CASPAR_DIR);
    await loadConfigQuiet();

    const configPath = path.join(process.cwd(), 'config.json');
    const cmd = args[0];

    if (!cmd || cmd === '--help' || cmd === '-h') {
        printUsage();
        return;
    }

    if (cmd === 'show') {
        const cfg = config as unknown as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [k, meta] of Object.entries(schema)) {
            const val = hasPath(cfg, k) ? getPath(cfg, k) : meta.default;
            setPath(out, k, meta.secret && val ? '***' : val);
        }
        console.log(JSON.stringify(out, null, 2));
        return;
    }

    if (cmd === 'get') {
        const key = args[1];
        if (!key) {
            console.error('Error: get requires a key name.');
            process.exit(1);
        }
        const meta = schema[key];
        if (!meta) {
            console.error(
                `Error: unknown key "${key}". Run "manager config keys" to see valid keys.`,
            );
            process.exit(1);
        }
        const cfg = config as unknown as Record<string, unknown>;
        const val = hasPath(cfg, key) ? getPath(cfg, key) : meta.default;
        console.log(JSON.stringify(val ?? null));
        return;
    }

    if (cmd === 'set') {
        const key = args[1];
        const raw = args[2];
        if (!key || raw === undefined) {
            console.error('Error: set requires a key and a value.');
            process.exit(1);
        }
        const meta = schema[key];
        if (!meta) {
            console.error(
                `Error: unknown key "${key}". Run "manager config keys" to see valid keys.`,
            );
            process.exit(1);
        }

        const coerced = coerce(raw, meta.type);

        // Read the raw file (not merged defaults) so we only persist explicit overrides.
        const [readErr, rawContent] = await noTryAsync(() =>
            fs.readFile(configPath, 'utf8'),
        );
        let existing: Record<string, unknown> = {};
        if (!readErr) {
            const [parseErr, parsed] = noTry<Record<string, unknown>>(() =>
                JSON.parse(rawContent ?? '{}'),
            );
            if (parseErr) {
                console.error(
                    `Error: failed to parse existing config.json: ${parseErr.message}`,
                );
                process.exit(1);
            }
            existing = parsed ?? {};
        }

        setPath(existing, key, coerced);
        const [writeErr] = await noTryAsync(() =>
            fs.writeFile(configPath, JSON.stringify(existing, null, 2), 'utf8'),
        );
        if (writeErr) {
            console.error(
                `Error: failed to write config.json: ${(writeErr as Error).message}`,
            );
            process.exit(1);
        }
        console.log(`Set ${key} = ${JSON.stringify(coerced)}`);
        return;
    }

    if (cmd === 'keys') {
        const entries = Object.entries(schema);
        const maxKey = Math.max(...entries.map(([k]) => k.length));
        const maxType = Math.max(...entries.map(([, m]) => m.type.length));
        const maxDefault = Math.max(
            ...entries.map(([, m]) => JSON.stringify(m.default).length),
        );

        for (const [key, meta] of entries) {
            const def = JSON.stringify(meta.default);
            console.log(
                `  ${key.padEnd(maxKey)}  ${meta.type.padEnd(maxType)}  ${def.padEnd(maxDefault)}  ${meta.desc}`,
            );
        }
        return;
    }

    console.error(`Unknown command: ${cmd}`);
    printUsage();
    process.exit(1);
}
