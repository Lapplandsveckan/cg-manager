import {Logger} from '../util/log';
import {MediaScanner} from './scanner';
import {CasparProcess} from './caspar/process';
import {EventEmitter} from 'events';

export class CasparManager extends EventEmitter {
    public scanner: MediaScanner;
    public caspar: CasparProcess;

    private static instance: CasparManager;
    public static getManager() {
        if (!CasparManager.instance) CasparManager.instance = new CasparManager();
        return CasparManager.instance;
    }

    private constructor() {
        super();

        this.scanner = new MediaScanner();
        this.caspar = new CasparProcess();

        this.caspar.on('status', (status) => this.emit('caspar-status', status));
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