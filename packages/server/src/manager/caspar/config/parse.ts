import * as xml2js from 'xml2js';
import { type Config, type LogLevel, type XmlNode } from './types';
import { transforms } from './transforms';

const LOG_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>([
    'trace',
    'debug',
    'info',
    'warning',
    'error',
    'fatal',
]);

export class ConfigParser {
    private config: string | null;
    constructor(config: string | null) {
        this.config = config;
    }

    public get header() {
        if (!this.config) return null;
        return ConfigParser.header(this.config);
    }

    private parseChannel(channel: XmlNode) {
        const rawConsumers = channel.consumers?.[0];
        const consumers: XmlNode =
            typeof rawConsumers === 'object' ? rawConsumers : {};

        const values = Object.entries(consumers)
            .map(([k, v]) =>
                v.map(v => ({
                    type: k,
                    data: typeof v === 'object' ? v : {},
                })),
            )
            .flat()
            .map(consumer => {
                const transform = transforms[consumer.type];
                if (!transform) return consumer;

                return {
                    ...consumer,
                    data: transform.parse(consumer.data),
                };
            });

        return {
            videoMode: channel['video-mode'][0] as string,
            consumers: values,
        };
    }

    private parseVideoMode(videoMode: XmlNode) {
        return {
            id: videoMode.id[0] as string,
            width: parseInt(videoMode.width[0] as string),
            height: parseInt(videoMode.height[0] as string),
            timeScale: parseInt(videoMode['time-scale'][0] as string),
            duration: parseInt(videoMode.duration[0] as string),
            cadence: parseInt(videoMode.cadence[0] as string),
        };
    }

    public async parse() {
        if (!this.config || !this.header) return null;
        const xml = (await xml2js.parseStringPromise(
            this.config,
        )) as XmlNode & { configuration: XmlNode };

        const config: Partial<Config> = {};
        const header = this.header;
        if (header) config.version = header.version;

        const rawLogLevel = xml.configuration['log-level']?.[0];
        if (
            typeof rawLogLevel === 'string' &&
            LOG_LEVELS.has(rawLogLevel as LogLevel)
        )
            config.logLevel = rawLogLevel as LogLevel;

        if (xml.configuration.html?.[0]) {
            const html = xml.configuration.html[0] as XmlNode;
            config.html = {};

            const remoteDebuggingPort = html['remote-debugging-port']?.[0];
            if (remoteDebuggingPort)
                config.html.remoteDebuggingPort = parseInt(
                    remoteDebuggingPort as string,
                );

            const enableGpu = html['enable-gpu']?.[0];
            if (enableGpu) config.html.enableGpu = enableGpu === 'true';
        }

        const videoModesNode = xml.configuration['video-modes'][0] as XmlNode;
        config.videoModes = (videoModesNode['video-mode'] as XmlNode[]).map(
            videoMode => this.parseVideoMode(videoMode),
        );

        const channelsNode = xml.configuration.channels[0] as XmlNode;
        config.channels = (channelsNode.channel as XmlNode[]).map(channel =>
            this.parseChannel(channel),
        );

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
