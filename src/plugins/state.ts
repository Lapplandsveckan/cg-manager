import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import config from '../util/config';

/** Read the persisted disabled-plugin set from plugin-state-file.
 *  Tolerates ENOENT (fresh install) and JSON parse errors gracefully. */
export async function readDisabled(): Promise<Set<string>> {
    const file = config['plugin-state-file'];
    if (!file) return new Set();

    const [readErr, raw] = await noTryAsync(() => fs.readFile(file, 'utf8'));
    if (readErr) return new Set();

    const [parseErr, parsed] = noTry(() => JSON.parse(raw));
    if (parseErr) return new Set();

    const disabled = Array.isArray(parsed?.disabled)
        ? parsed.disabled.filter(
              (n: unknown): n is string => typeof n === 'string',
          )
        : [];
    return new Set(disabled);
}

/** Persist the disabled-plugin set to plugin-state-file. */
export async function writeDisabled(disabled: Set<string>): Promise<void> {
    const file = config['plugin-state-file'];
    if (!file) return;

    const content = JSON.stringify({ disabled: [...disabled].sort() }, null, 2);
    await fs.writeFile(file, content, 'utf8');
}
