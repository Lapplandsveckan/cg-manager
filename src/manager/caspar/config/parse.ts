import * as xml2js from 'xml2js';
import {Config} from './types';
import {transforms} from './transforms';

export class ConfigParser {
    private config: string | null;
    constructor(config: string | null) {
        this.config = config;
    }

    public get header() {
        if (!this.config) return null;
        return ConfigParser.header(this.config);
    }

    private parseChannel(channel: any) {
        const values = Object
            .entries(typeof channel.consumers[0] === 'object' ? channel.consumers[0] : {})
            .map(([k, v]) =>
                (v as any)
                    .map((v: any) => ({
                        type: k,
                        data: typeof v === 'object' ? v : {},
                    })),
            )
            .flat()
            .map((consumer: any) => {
                const transform = transforms[consumer.type];
                if (!transform) return consumer;

                return {
                    ...consumer,
                    data: transform.parse(consumer.data),
                };
            });

        return {
            videoMode: channel['video-mode'][0],
            consumers: values,
        };
    }

    private parseVideoMode(videoMode: any) {
        return {
            id: videoMode.id[0],
            width: parseInt(videoMode.width[0]),
            height: parseInt(videoMode.height[0]),
            timeScale: parseInt(videoMode['time-scale'][0]),
            duration: parseInt(videoMode.duration[0]),
            cadence: parseInt(videoMode.cadence[0]),
        };
    }

    public async parse() {
        if (!this.config || !this.header) return null;
        const xml = await xml2js.parseStringPromise(this.config);

        const config: Partial<Config> = {};
        const header = this.header;
        if (header) config.version = header.version;

        if (xml.configuration.html?.[0]) {
            const html = xml.configuration.html[0];
            config.html = {};

            const remoteDebuggingPort = html['remote-debugging-port']?.[0];
            if (remoteDebuggingPort) config.html.remoteDebuggingPort = parseInt(remoteDebuggingPort);

            const enableGpu = html['enable-gpu']?.[0];
            if (enableGpu) config.html.enableGpu = enableGpu === 'true';
        }

        config.videoModes = xml.configuration['video-modes'][0]['video-mode'].map(this.parseVideoMode);
        config.channels = xml.configuration.channels[0].channel.map(this.parseChannel);
        config._raw = xml;

        return config as Config;
    }

    public static parse(config: string) {
        return new ConfigParser(config).parse();
    }

    public static header(config: string) {
        const header = config.match(/<!-- CG - (.+?) -->/);
        if (!header) return null;

        return {
            version: header[1],
        };
    }
}