import path from 'path';
import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import config, { loadConfigQuiet } from '../util/config';
import { schema } from '../util/_config';

function printUsage() {
    console.log(`Usage: manager config <command>

Commands:
  show              Print the effective config (secret values redacted)
  get <key>         Print the current value of one key
  set <key> <val>   Write a value into config.json (use null to clear)
  keys              List all keys with their type, default, and description
`);
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
            const val = k in cfg ? cfg[k] : meta.default;
            out[k] = meta.secret && val ? '***' : val;
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
            console.error(`Error: unknown key "${key}". Run "manager config keys" to see valid keys.`);
            process.exit(1);
        }
        const cfg = config as unknown as Record<string, unknown>;
        const val = key in cfg ? cfg[key] : meta.default;
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
            console.error(`Error: unknown key "${key}". Run "manager config keys" to see valid keys.`);
            process.exit(1);
        }

        let coerced: string | number | boolean | null;
        if (raw === 'null') {
            coerced = null;
        } else if (meta.type === 'number') {
            const n = Number(raw);
            if (Number.isNaN(n)) {
                console.error(`Error: "${raw}" is not a valid number.`);
                process.exit(1);
            }
            coerced = n;
        } else if (meta.type === 'boolean') {
            if (raw === 'true') coerced = true;
            else if (raw === 'false') coerced = false;
            else {
                console.error(`Error: "${raw}" is not a valid boolean. Use true or false.`);
                process.exit(1);
            }
        } else {
            coerced = raw;
        }

        // Read the raw file (not merged defaults) so we only persist explicit overrides.
        const [readErr, rawContent] = await noTryAsync(() => fs.readFile(configPath, 'utf8'));
        let existing: Record<string, unknown> = {};
        if (!readErr) {
            const [parseErr, parsed] = noTry<Record<string, unknown>>(() => JSON.parse(rawContent ?? '{}'));
            if (parseErr) {
                console.error(`Error: failed to parse existing config.json: ${parseErr.message}`);
                process.exit(1);
            }
            existing = parsed ?? {};
        }

        existing[key] = coerced;
        const [writeErr] = await noTryAsync(() =>
            fs.writeFile(configPath, JSON.stringify(existing, null, 2), 'utf8'),
        );
        if (writeErr) {
            console.error(`Error: failed to write config.json: ${(writeErr as Error).message}`);
            process.exit(1);
        }
        console.log(`Set ${key} = ${JSON.stringify(coerced)}`);
        return;
    }

    if (cmd === 'keys') {
        const entries = Object.entries(schema);
        const maxKey     = Math.max(...entries.map(([k])    => k.length));
        const maxType    = Math.max(...entries.map(([, m])  => m.type.length));
        const maxDefault = Math.max(...entries.map(([, m])  => JSON.stringify(m.default).length));

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
