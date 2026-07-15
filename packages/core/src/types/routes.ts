import { type CasparManager } from '../index';

interface DecklinkSource {
    device: number;
    format: string;

    type: 'decklink';
}

interface VideoSource {
    video: string;
    type: 'video';
}

interface ChannelSource {
    channel: number;
    type: 'channel';
}

interface ColorSource {
    color: string;
    type: 'color';
}

interface EffectGroupDestination {
    effectLayer: string;
    index?: number;

    type: 'effect-group';
}

type Source = DecklinkSource | VideoSource | ChannelSource | ColorSource;
type Destination = EffectGroupDestination;

export interface VideoRoute {
    id: string;
    name: string;

    transform?: number[];
    edgeblend?: number[];
    /** Eight numbers — quad corners in TL, TR, BR, BL order. */
    perspective?: number[];

    source: Source;
    destination: Destination;

    enabled: boolean;
    metadata?: Record<string, any>;
}

export interface RouteChange {
    method: 'CREATE' | 'UPDATE' | 'DELETE';
    data: VideoRoute | string;
}

export declare class VideoRoutesManager {
    public constructor(manager: CasparManager);

    public createVideoRoute(data: Omit<VideoRoute, 'id'>): VideoRoute;
    public getVideoRoute(id: string): VideoRoute | null;
    public getVideoRoutes(): VideoRoute[];
    public updateVideoRoute(data: VideoRoute): Promise<void>;

    public loadVideoRoutes(): Promise<void>;
    public saveVideoRoute(route: VideoRoute): Promise<void>;
    public deleteVideoRoute(id: string): Promise<void>;

    public enableVideoRoute(id: string): void;
    public disableVideoRoute(id: string): void;
    public setVideoRouteEnabled(id: string, enabled: boolean): void;
}
