import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {Logger} from '../../util/log';
import { EventEmitter } from 'events';
import path from 'path';

const logger = Logger.scope('CasparCG');
export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    private logs = '';

    appendLog(data: string) {
        this.logs += data;
        this.emit('log', data);
    }

    async start() {
        if (this.process) return;

        let cmd = path.join(process.cwd(), 'run.sh');
        if (process.platform === 'win32') cmd = path.join(process.cwd(), 'casparcg.exe');
        if (process.platform === 'darwin') return logger.error('Could not start CasparCG: macOS is not supported yet!');

        this.process = spawn(cmd, []);
        this.process.stdout.on('data', (data) => {
            this.appendLog(data.toString());
            logger.debug(data.toString());
        });
        this.process.stderr.on('data', (data) => {
            this.appendLog(data.toString());
            logger.error(data.toString());
        });

        this.process.on('error', (code) => {
            logger.error(`Could not start CasparCG: ${code}`);
        });

        this.process.on('close', (code) => {
            logger.warn(`CasparCG exited with code ${code}`);
            this.process = null;
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

    getStatus() {
        return {
            running: this.running,
        };
    }

    getLogs() {
        return this.logs;
    }
}