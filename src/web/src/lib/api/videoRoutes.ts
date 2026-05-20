import {REPClient} from 'rest-exchange-protocol-client';

export interface DecklinkSource {
    type: 'decklink';
    device: number;
    format: string;
    keyDevice?: number;
}

export interface VideoSource {
    type: 'video';
    video: string;
}

export interface ChannelSource {
    type: 'channel';
    channel: number;
}

export interface ColorSource {
    type: 'color';
    color: string;
}

export type VideoRouteSource = DecklinkSource | VideoSource | ChannelSource | ColorSource;

export interface VideoRouteDestination {
    type: 'effect-group';
    effectLayer: string;
    index?: number;
}

export interface VideoRoute {
    id: string;
    name: string;

    transform?: number[];
    edgeblend?: number[];

    source: VideoRouteSource;
    destination: VideoRouteDestination;

    enabled: boolean;
    metadata?: Record<string, unknown>;
}

export class VideoRoutesApi {
    private socket: REPClient;

    constructor(socket: REPClient) {
        this.socket = socket;
    }

    public async list(): Promise<VideoRoute[]> {
        const res = await this.socket.request('api/routes', 'GET', {});
        return (res.data as VideoRoute[]) ?? [];
    }

    public async get(id: string): Promise<VideoRoute> {
        const res = await this.socket.request(`api/routes/${encodeURIComponent(id)}`, 'GET', {});
        return res.data as VideoRoute;
    }

    public async delete(id: string): Promise<void> {
        await this.socket.request(`api/routes/${encodeURIComponent(id)}`, 'DELETE', {});
    }

    public async setEnabled(id: string, enabled: boolean): Promise<VideoRoute> {
        const action = enabled ? 'enable' : 'disable';
        const res = await this.socket.request(
            `api/routes/${encodeURIComponent(id)}/${action}`,
            'ACTION',
            {},
        );
        return res.data as VideoRoute;
    }
}
