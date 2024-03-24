import {ConfigParser} from './parse';
import * as fs from 'fs/promises';
import * as path from 'path';
import {noTryAsync} from 'no-try';
import {ConfigBuilder} from './build';
import {Logger} from '../../../util/log';
import {Config} from './types';

function getDefaults() {
    return {
        version: '0.0.1',
        html: {
            remoteDebuggingPort: 9222,
            enableGpu: false,
        },
        videoModes: [
            {
                id: '1920x1080p6000',
                width: 1920,
                height: 1080,
                timeScale: 6000,
                duration: 1000,
                cadence: 800,
            },
        ],
        channels: [
            {
                videoMode: '1920x1080p6000',
                consumers: [
                    {
                        type: 'screen',
                        data: {
                            device: 2,
                            windowed: true,
                            borderless: true,
                            width: 1920,
                            height: 1200,
                            // alwaysOnTop: true,
                        },
                    },
                    { type: 'system-audio', data: {} },
                ],
            },
            {
                videoMode: '1920x1080p6000',
                consumers: [],
            },
            {
                videoMode: '1920x1080p6000',
                consumers: [],
            },
        ],
    } as Config;
}

export class ConfigManager {
    private config: Config;
    private path: string;
    private logger = Logger.scope('Caspar Config');

    constructor(uri?: string) {
        this.setPath(uri);
    }

    public setPath(uri: string) {
        this.path = uri || process.cwd();
        if (this.path.endsWith('/')) this.path = path.join(this.path, 'casparcg.config');
    }

    private loading: Promise<any>;
    public get(force = false): Promise<Config> {
        if (!this.loading || force) this.loading = this.load();
        return this.loading;
    }

    private async load() {
        const stat = await fs.stat(this.path).catch(() => null);
        if (stat?.isDirectory()) this.path = path.join(this.path, 'casparcg.config');

        const data = await fs.readFile(this.path, 'utf-8').catch(() => null);
        const parser = new ConfigParser(data);

        this.config = await parser.parse();
        if (!this.config) {
            const [error] = await noTryAsync(() => fs.rename(this.path, `${this.path}-${Date.now()}.bak`));

            if (error)
                if ((error as any).code !== 'ENOENT') this.logger.error(error);

            if (!error)
                this.logger.warn('Invalid configuration file, moved to backup');

            this.config = getDefaults();
            await this.save();
        }

        return this.config;
    }

    public async save() {
        if (!this.config) return;

        const stat = await fs.stat(this.path).catch(() => null);
        if (stat?.isDirectory()) this.path = path.join(this.path, 'casparcg.config');
        
        const builder = new ConfigBuilder(this.config);
        const content = builder.build();

        await fs.writeFile(this.path, content, 'utf-8');
    }
}