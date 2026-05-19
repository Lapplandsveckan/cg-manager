import Bonjour from 'bonjour-service';
import config from '../util/config';
import {Logger} from '../util/log';

const PUBLISH_TIMEOUT_MS = 5000;

export class Discovery {
    private instance: Bonjour;
    constructor() {
        this.instance = new Bonjour();
    }

    start() {
        return new Promise<void>((resolve) => {
            const id = Math.random().toString(36).substring(7);
            const service = this.instance.publish({ name: `CG Manager (${id})`, type: 'cg-manager', port: config.port });

            let settled = false;
            const finish = (err?: unknown) => {
                if (settled) return;
                settled = true;

                clearTimeout(timer);
                if (err) Logger.warn(`Bonjour discovery failed to publish: ${err}; continuing without mDNS.`);
                
                resolve();
            };

            service.on('up', () => finish());
            service.on('error', (err: unknown) => finish(err));
            const timer = setTimeout(() => finish(new Error(`timed out after ${PUBLISH_TIMEOUT_MS}ms`)), PUBLISH_TIMEOUT_MS);
        });
    }

    stop() {
        return new Promise<void>((resolve) => {
            this.instance.unpublishAll(() => {
                this.instance.destroy();
                resolve();
            });
        });
    }
}