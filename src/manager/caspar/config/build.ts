import * as xml2js from 'xml2js';
import {Config, ConfigChannel, ConfigVideoMode} from './types';
import {transforms} from './transforms';

export class ConfigBuilder {
    private config: Config;
    constructor(config: Config) {
        this.config = config;
    }

    public get header() {
        return `<!-- CG - ${this.config.version} -->`;
    }

    private buildConfigChannel(channel: ConfigChannel) {
        const consumers: Record<string, any> = {};
        for (const consumer of channel.consumers) {
            if (!consumers[consumer.type]) consumers[consumer.type] = [];

            const transform = transforms[consumer.type];
            const data = transform ? transform.serialize(consumer.data) : consumer.data;
            consumers[consumer.type].push(data);
        }

        return {
            'video-mode': channel.videoMode,
            consumers,
        };
    }

    private buildConfigVideoMode(videoMode: ConfigVideoMode) {
        return {
            id: videoMode.id,
            width: videoMode.width,
            height: videoMode.height,
            'time-scale': videoMode.timeScale,
            duration: videoMode.duration,
            cadence: videoMode.cadence,
        };
    }

    private buildConfig() {
        return {
            configuration: {
                'log-level': 'trace',
                paths: {
                    'media-path': 'media/',
                    'log-path': 'log/',
                    'data-path': 'data/',
                    'template-path': 'template/',
                },
                'video-modes': {
                    'video-mode': this.config.videoModes.map((videoMode: any) => this.buildConfigVideoMode(videoMode)),
                },
                channels: {
                    channel: this.config.channels.map((channel: any) => this.buildConfigChannel(channel)),
                },
                controllers: {
                    tcp: {
                        port: 5250,
                        protocol: 'amcp',
                    },
                },
                html: {
                    'remote-debugging-port': this.config.html?.remoteDebuggingPort ?? 9222,
                    'enable-gpu': this.config.html?.enableGpu ?? false,
                },
            },
        };
    }

    public build() {
        const obj = this.buildConfig();
        const builder = new xml2js.Builder({ headless: true });

        return [
            '<?xml version="1.0" encoding="utf-8"?>',
            this.header,
            '<!-- NOTE: Do not alter manually, refer to the cg-manager -->',
            builder.buildObject(obj),
        ].join('\n');
    }

    public static build(config: Config) {
        return new ConfigBuilder(config).build();
    }
}