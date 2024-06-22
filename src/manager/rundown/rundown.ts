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
}

export interface RundownState {

}

export interface RundownInstance {
    rundown: Rundown;
    state: RundownState;
}

export class RundownManager {
    private rundowns = new Map<string, RundownInstance>();
    public executor = new RundownExecutor();

    public createRundown(name: string): Rundown {
        const id = UUID.generate();
        const rundown = {
            id,
            name,
            items: [],
        };

        const state = {};
        this.rundowns.set(id, {rundown, state});
        return rundown;
    }

    public getRundown(id: string): Rundown | null {
        return this.rundowns.get(id)?.rundown ?? null;
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

    public async saveRundown(rundown: Rundown) {
        const dir = config['rundown-dir'];
        const file = path.join(dir, `${rundown.id}.json`);

        const content = JSON.stringify(rundown, null, 2);
        const [err] = await noTryAsync(() => fs.writeFile(file, content));
        if (!err) return;

        Logger.error(`Failed to save rundown ${rundown.id} (${file})`);
        Logger.error(err);
    }

    public async deleteRundown(id: string) {
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