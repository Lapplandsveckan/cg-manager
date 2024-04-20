import {CasparPlugin} from '@lappis/cg-manager';
import * as http from 'http';

export default class PropresenterPlugin extends CasparPlugin {
    private dest = '127.0.0.1:50001';

    private req: any;
    private enabled = false;
    private slide: string;

    public static get pluginName() {
        return 'propresenter';
    }

    protected onEnable() {
        // this.enableApi();
    }

    protected onDisable() {
        this.disableApi();
    }

    public parseData(data: any) {
        this.slide = data?.current?.text ?? '';
        console.log('Current slide:', this.slide);

        // TODO: Send slide to CasparCG
    }

    public enableApi() {
        if (this.enabled) return;
        this.enabled = true;
        this.slide = this.slide ?? '';

        const url = `http://${this.dest}/v1/status/slide?chunked=true`;
        this.req = http.get(url, (res) => {
            console.log('Connected to ProPresenter');
            res.on('data', d => this.parseData(JSON.parse(d)));
            res.on('end', () => {
                if (!this.enabled) return;

                this.enabled = false;
                this.enableApi();
            });
        });

        this.req.on('error', (e) => {
            console.error('Propresenter error', e);
            setTimeout(() => {
                if (!this.enabled) return;

                this.enabled = false;
                this.enableApi();
            }, 1000);
        });
    }

    public disableApi() {
        if (!this.enabled) return;
        this.enabled = false;
        this.req.abort();
        this.slide = undefined;
    }
}