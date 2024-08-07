import config from '../../util/config';
import fs from 'fs/promises';
import {UUID} from '../../util/uuid';
import path from 'path';
import {Logger} from '../../util/log';
import {noTryAsync} from 'no-try';

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

    public async loadRundowns() {
        const dir = config['rundown-dir'];
        const [err, files] = await noTryAsync(() => fs.readdir(dir));
        if (err) {
            Logger.error('Failed to read rundown dir');
            Logger.error(err);
            return;
        }

        const rundowns: Rundown[] = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
            const content = await fs.readFile(path.join(dir, file), 'utf8').catch(e => {
                Logger.error(`Failed to read rundown (${file})`);
                Logger.error(e);
                return null;
            });

            return content && JSON.parse(content);
        }));

        rundowns
            .filter(Boolean)
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

        const content = JSON.stringify(rundown, null, 2);
        const [err] = await noTryAsync(() => fs.writeFile(file, content));
        if (!err) return;

        Logger.error(`Failed to save rundown ${rundown.id} (${file})`);
        Logger.error(err);
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