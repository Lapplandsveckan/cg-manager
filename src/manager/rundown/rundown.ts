import config from '../../util/config';
import fs from 'fs/promises';
import {UUID} from '../../util/uuid';
import path from 'path';
import {Logger} from '../../util/log';
import {noTry, noTryAsync} from 'no-try';

export interface RundownItem {
    id: string;
    title: string;

    type: string;
    data: any;

    metadata: {
        autoNext: boolean;
    };
}

export interface Rundown {
    id: string;
    name: string;

    items: RundownItem[];
    type?: 'rundown' | 'quick';
}

export interface RundownState {

}

export interface RundownInstance {
    rundown: Rundown;
    state: RundownState;
}

export class RundownManager {
    private rundowns = new Map<string, RundownInstance>();
    private timer: NodeJS.Timeout;
    public executor = new RundownExecutor();

    public createRundown(name: string, type?: Rundown['type']): Rundown {
        const id = UUID.generate();
        const rundown = {
            id,
            name,
            items: [],

            type,
        };

        const state = {};
        this.rundowns.set(id, {rundown, state});
        return rundown;
    }

    public getRundown(id: string): Rundown | null {
        return this.rundowns.get(id)?.rundown ?? null;
    }

    public getRundowns(): Rundown[] {
        return Array.from(this.rundowns.values()).map(({rundown}) => rundown).filter(rundown => rundown.type !== 'quick');
    }

    public getQuickActions(): Rundown[] {
        return Array.from(this.rundowns.values()).map(({rundown}) => rundown).filter(rundown => rundown.type === 'quick');
    }

    public async updateRundown(id: string, name: string) {
        const rundown = this.getRundown(id);
        if (!rundown) return;

        rundown.name = name;
        await this.saveRundown(rundown);
    }

    // Tolerant read: returns the parsed rundown, or null if the file is
    // missing, empty, or doesn't have the expected shape. Empty files happen
    // when a save is interrupted by power loss after the OS truncated the
    // file but before the new bytes were durably written — atomic save
    // (saveRundown) prevents this going forward, but we still need a tolerant
    // reader for files that pre-date the fix.
    private async parseRundownFile(p: string): Promise<Rundown | null> {
        const [err, content] = await noTryAsync(() => fs.readFile(p, 'utf8'));
        if (err) return null;
        if (!content.trim()) return null;

        const [parseErr, parsed] = noTry(() => JSON.parse(content));
        if (parseErr) {
            Logger.error(`Failed to parse rundown (${p}): ${parseErr.message}`);
            return null;
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
            Logger.error(`Rundown (${p}) has unexpected shape — skipping`);
            return null;
        }
        return parsed as Rundown;
    }

    private async readWithRecovery(file: string): Promise<Rundown | null> {
        const dir = config['rundown-dir'];
        const primary = path.join(dir, file);
        const tmp = `${primary}.tmp`;

        const direct = await this.parseRundownFile(primary);
        if (direct) {
            // Stale .tmp from a crashed save that landed at the primary path
            // earlier (or from before this code shipped) — remove so it
            // doesn't shadow a future recovery attempt.
            await noTryAsync(() => fs.unlink(tmp));
            return direct;
        }

        const recovered = await this.parseRundownFile(tmp);
        if (recovered) {
            Logger.warn(`Recovering rundown ${file} from .tmp — primary file was empty/corrupt`);
            const [renameErr] = await noTryAsync(() => fs.rename(tmp, primary));
            if (renameErr) Logger.error(`Failed to commit recovered .tmp: ${renameErr.message}`);
            return recovered;
        }

        Logger.error(`Rundown ${file} is empty/corrupt and no .tmp recovery is available — skipping`);
        return null;
    }

    public async loadRundowns() {
        const dir = config['rundown-dir'];
        const [err, files] = await noTryAsync(() => fs.readdir(dir));
        if (err) {
            Logger.error('Failed to read rundown dir');
            Logger.error(err);
            return;
        }

        const jsonFiles = files.filter(file => file.endsWith('.json'));
        const rundowns = await Promise.all(jsonFiles.map(file => this.readWithRecovery(file)));

        rundowns
            .filter((r): r is Rundown => Boolean(r))
            .forEach(rundown => this.rundowns.set(rundown.id, {rundown, state: {}}));
    }

    public startAutosave() {
        this.timer = setInterval(() => this.saveAllRundowns(), 1000 * 60);
    }

    public stopAutosave() {
        clearInterval(this.timer);
    }

    public async saveRundown(rundown: Rundown) {
        const dir = config['rundown-dir'];
        const file = path.join(dir, `${rundown.id}.json`);
        const tmp = `${file}.tmp`;

        const content = JSON.stringify(rundown, null, 2);

        // Atomic save: write to a sibling .tmp + fsync so the bytes are
        // durable on disk, then atomically rename over the primary file.
        // A crash before rename leaves the primary intact; a crash after
        // leaves the new content in place. The previous fs.writeFile path
        // truncated the file first, so a power loss between truncate and
        // write left a 0-byte file with the rundown gone — that's what
        // readWithRecovery now defends against by also probing .tmp.
        const [openErr, fh] = await noTryAsync(() => fs.open(tmp, 'w'));
        if (openErr) {
            Logger.error(`Failed to open rundown tmp (${tmp})`);
            Logger.error(openErr);
            return;
        }

        const [writeErr] = await noTryAsync(() => fh.writeFile(content));
        if (!writeErr) await noTryAsync(() => fh.sync());
        await noTryAsync(() => fh.close());

        if (writeErr) {
            Logger.error(`Failed to write rundown ${rundown.id} (${file})`);
            Logger.error(writeErr);
            await noTryAsync(() => fs.unlink(tmp));
            return;
        }

        const [renameErr] = await noTryAsync(() => fs.rename(tmp, file));
        if (renameErr) {
            Logger.error(`Failed to commit rundown ${rundown.id} (${file})`);
            Logger.error(renameErr);
            await noTryAsync(() => fs.unlink(tmp));
        }
    }

    public async saveAllRundowns() {
        await Promise.all(Array.from(this.rundowns.values()).map(({rundown}) => this.saveRundown(rundown)));
    }

    public async deleteRundown(id: string) {
        this.rundowns.delete(id);

        const dir = config['rundown-dir'];
        const file = path.join(dir, `${id}.json`);

        const [err] = await noTryAsync(() => fs.unlink(file));
        if (!err || err['code'] === 'ENOENT') return;

        Logger.error(`Failed to delete rundown ${id} (${file})`);
        Logger.error(err);
    }
}

export class RundownExecutor {
    private actions = new Map<string, (item: RundownItem) => Promise<void> | void>();
    public getActionTypes() {
        return Array.from(this.actions.keys());
    }

    public registerAction(type: string, action: (item: RundownItem) => Promise<void> | void) {
        this.actions.set(type, action);
    }

    public async executeItem(item: RundownItem) {
        const action = this.actions.get(item.type);
        if (!action) {
            Logger.warn(`Unknown action type: ${item.type}`);
            return;
        }

        await action(item);
    }
}