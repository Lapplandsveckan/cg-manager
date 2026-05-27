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

// Cap the in-memory log buffer so a long-running CasparCG instance doesn't
// grow the string unboundedly. The cap is also what `getLogs()` returns and
// what a newly-loaded client receives as the initial dump, so the browser
// never has to allocate more than this on first paint of the Server page.
const LOG_BUFFER_MAX = 256 * 1024;

const logger = Logger.scope('CasparCG');
export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    private logs = '';
    private lastError: string | null = null;
    public config: Config;

    appendLog(data: string) {
        this.logs += data;
        if (this.logs.length > LOG_BUFFER_MAX) 
            this.logs = this.logs.slice(this.logs.length - LOG_BUFFER_MAX);
        
        this.emit('log', data);
    }

    private get supported(): boolean {
        return SUPPORTED_PLATFORMS.includes(process.platform);
    }

    async start() {
        if (this.process) return;

        configuration.setPath(this.casparPath);
        this.config = await configuration.get(); // ensure right config

        if (!this.supported) {
            this.lastError = `CasparCG cannot be started on ${process.platform} — only Linux and Windows are supported.`;
            logger.error(this.lastError);
            this.emit('status', this.getStatus());
            return;
        }

        const cmd = process.platform === 'win32'
            ? path.join(this.casparPath, 'casparcg.exe')
            : path.join(this.casparPath, 'run.sh');

        this.lastError = null;
        this.process = spawn(cmd, [], { cwd: this.casparPath });

        // CasparCG read `this.config` from disk at startup — surface it as the
        // running snapshot so UI consumers (previews, routes) can distinguish
        // "what's actually live" from "what's on disk". Future edits to disk
        // don't update this until restart.
        this.emit('running-config', this.getRunningConfig());

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
            // Snapshot is null once the process is gone.
            this.emit('running-config', this.getRunningConfig());
        });

        this.emit('status', this.getStatus());
    }

    async stop() {
        if (!this.process) return;
        const proc = this.process;
        const closed = new Promise<void>((resolve) => proc.once('close', () => resolve()));
        proc.kill();
        await closed;
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

    /** Config CasparCG was last started with. Null when the process isn't
     *  running. Edits saved to disk after start don't update this until
     *  the next start/restart — this is the "what's actually live" view. */
    getRunningConfig(): Config | null {
        return this.running ? this.config : null;
    }

    getLogs() {
        return this.logs;
    }

    get casparPath() {
        return config['caspar-path'] || process.cwd();
    }
}
