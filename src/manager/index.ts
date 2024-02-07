import {Logger} from '../util/log';
import {MediaScanner} from './scanner';
import {CasparProcess} from './caspar/process';
import {EventEmitter} from 'events';
import {CasparExecutor} from './caspar/executor';

export class CasparManager extends EventEmitter {
    public scanner: MediaScanner;
    public caspar: CasparProcess;
    public executor: CasparExecutor;

    private static instance: CasparManager;
    public static getManager() {
        if (!CasparManager.instance) CasparManager.instance = new CasparManager();
        return CasparManager.instance;
    }

    private constructor() {
        super();

        this.scanner = new MediaScanner();
        this.caspar = new CasparProcess();

        this.executor = new CasparExecutor();
        this.executor.allocateChannel(1); // TODO: Remove this line

        this.caspar.on('status', (status) => this.emit('caspar-status', status));
        this.caspar.on('status', (status) => status.running && setTimeout(() => this.executor.connect(), 500));
        this.caspar.on('log', (log) => this.emit('caspar-logs', log));
    }

    async start() {
        Logger.info('Starting media scanner...');
        await this.scanner.start();

        Logger.info('Starting Caspar CG process...');
        await this.caspar.start();
    }

    async stop() {
        await this.scanner.stop();
        await this.caspar.stop();

        this.scanner = null;
        this.caspar = null;
    }

    public getMediaScanner() {
        return this.scanner;
    }

    public getCasparProcess() {
        return this.caspar;
    }
}