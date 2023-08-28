import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {Logger} from '../../util/log';
import { EventEmitter } from 'events';
import path from 'path';

const logger = Logger.scope('CasparCG');
export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    private logs = '';

    async start() {
        let cmd = path.join(process.cwd(), 'run.sh');
        if (process.platform === 'win32') cmd = path.join(process.cwd(), 'casparcg.exe');

        this.process = spawn(cmd, []);
        this.process.stdout.on('data', (data) => {
            this.logs += data.toString();
            logger.debug(data.toString());
        });
        this.process.stderr.on('data', (data) => {
            this.logs += data.toString();
            logger.error(data.toString());
        });

        this.process.on('error', (code) => {
            logger.error(`Could not start CasparCG: ${code}`);
        });

        this.process.on('close', (code) => {
            logger.warn(`CasparCG exited with code ${code}`);
            this.emit('status', false);
            this.process = null;
        });

        this.emit('status', true);
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
}