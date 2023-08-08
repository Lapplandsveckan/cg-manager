import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import {Logger} from '../../util/log';
import { EventEmitter } from 'events';

export class CasparProcess extends EventEmitter {
    private process: ChildProcessWithoutNullStreams = null;
    constructor() {
        super();
    }

    async start() {
        this.process = spawn('casparcg.exe', []);
        this.process.stdout.on('data', (data) => {
            Logger.scope('CasparCG').info(data.toString());
        });
        this.process.stderr.on('data', (data) => {
            Logger.scope('CasparCG').error(data.toString());
        });

        this.process.on('close', (code) => {
            Logger.scope('CasparCG').warn(`CasparCG exited with code ${code}`);
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