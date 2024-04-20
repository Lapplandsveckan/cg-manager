import Bonjour from 'bonjour-service';
import config from '../util/config';

export class Discovery {
    private instance: Bonjour;
    constructor() {
        this.instance = new Bonjour();
    }

    start() {
        return new Promise<void>((resolve, reject) => {
            const id = Math.random().toString(36).substring(7);
            const service = this.instance.publish({ name: `CG Manager (${id})`, type: 'cg-manager', port: config.port });
            service.on('up', () => {
                resolve();
            });
        });
    }

    stop() {
        return new Promise<void>((resolve, reject) => {
            this.instance.unpublishAll(() => {
                this.instance.destroy();
                resolve();
            });
        });
    }
}