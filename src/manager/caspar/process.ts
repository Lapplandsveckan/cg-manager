import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {Logger} from '../../util/log';
import { EventEmitter } from 'events';
import path from 'path';
import config from '../../util/config';
import {configuration} from '../config';
import {Config} from './config/types';

export interface CasparStatus {
    running: boolean;
    supported: boolean;
    lastError: string | null;
}

const SUPPORTED_PLATFORMS: NodeJS.Platform[] = ['linux', 'win32'];

const logger = Logger.scope('CasparCG');
export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    private logs = '';
    private lastError: string | null = null;
    public config: Config;

    appendLog(data: string) {
        this.logs += data;
        this.emit('log', data);
    }

    private get supported(): boolean {
        return SUPPORTED_PLATFORMS.includes(process.platform);
    }

    async start() {
        if (this.process) return;

        const folder = config['caspar-path'] || process.cwd();

        configuration.setPath(folder);
        this.config = await configuration.get(); // ensure right config

        if (!this.supported) {
            this.lastError = `CasparCG cannot be started on ${process.platform} — only Linux and Windows are supported.`;
            logger.error(this.lastError);
            this.emit('status', this.getStatus());
            return;
        }

        const cmd = process.platform === 'win32'
            ? path.join(folder, 'casparcg.exe')
            : path.join(folder, 'run.sh');

        this.lastError = null;
        this.process = spawn(cmd, [], { cwd: folder });

        this.process.stdout.on('data', (data) => {
            this.appendLog(data.toString());
            if (config['pipe-caspar']) logger.debug(data.toString());
        });
        this.process.stderr.on('data', (data) => {
            this.appendLog(data.toString());
            logger.error(data.toString());
        });

        this.process.on('error', (err) => {
            this.lastError = `Could not start CasparCG: ${err.message}`;
            logger.error(this.lastError);
            this.emit('status', this.getStatus());
        });

        this.process.on('close', (code) => {
            logger.warn(`CasparCG exited with code ${code}`);
            this.process = null;
            if (code !== 0 && code !== null) this.lastError = `CasparCG exited with code ${code}.`;
            this.emit('status', this.getStatus());
        });

        this.emit('status', this.getStatus());
    }

    async stop() {
        if (this.process) this.process.kill();
    }

    async restart() {
        await this.stop();
        await this.start();
    }

    get running() {
        return this.process !== null;
    }

    get log() {
        return this.logs;
    }

    getStatus(): CasparStatus {
        return {
            running: this.running,
            supported: this.supported,
            lastError: this.lastError,
        };
    }

    getLogs() {
        return this.logs;
    }
}
