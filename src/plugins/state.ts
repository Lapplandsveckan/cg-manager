import { promises as fs } from 'fs';
import { noTry, noTryAsync } from 'no-try';
import config from '../util/config';

export interface PluginState {
    disabled: Set<string>;
    /** folderName -> active version, for external plugins with multiple installed versions. */
    active: Record<string, string>;
}

/** Read the persisted plugin state (disabled set + active-version map) from
 *  plugin-state-file. Tolerates ENOENT (fresh install), JSON parse errors,
 *  and files written before the `active` field existed. */
export async function readState(): Promise<PluginState> {
    const file = config['plugin-state-file'];
    if (!file) return { disabled: new Set(), active: {} };

    const [readErr, raw] = await noTryAsync(() => fs.readFile(file, 'utf8'));
    if (readErr) return { disabled: new Set(), active: {} };

    const [parseErr, parsed] = noTry(() => JSON.parse(raw));
    if (parseErr) return { disabled: new Set(), active: {} };

    const disabled = Array.isArray(parsed?.disabled)
        ? parsed.disabled.filter(
              (n: unknown): n is string => typeof n === 'string',
          )
        : [];
    const active =
        parsed?.active && typeof parsed.active === 'object'
            ? Object.fromEntries(
                  Object.entries(parsed.active).filter(
                      (e): e is [string, string] => typeof e[1] === 'string',
                  ),
              )
            : {};
    return { disabled: new Set(disabled), active };
}

/** Persist the disabled-plugin set and active-version map together, so
 *  writing one never drops the other. */
export async function writeState(
    disabled: Set<string>,
    active: Record<string, string>,
): Promise<void> {
    const file = config['plugin-state-file'];
    if (!file) return;

    const content = JSON.stringify(
        { disabled: [...disabled].sort(), active },
        null,
        2,
    );
    await fs.writeFile(file, content, 'utf8');
}

/** Back-compat: read just the disabled set. */
export async function readDisabled(): Promise<Set<string>> {
    return (await readState()).disabled;
}

/** Back-compat: write just the disabled set, preserving the active map. */
export async function writeDisabled(disabled: Set<string>): Promise<void> {
    const { active } = await readState();
    await writeState(disabled, active);
}
