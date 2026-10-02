interface DecklinkSource {
    device: number;
    format: string;

    keyDevice?: number;

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

export type Source = DecklinkSource | VideoSource | ChannelSource | ColorSource;
export type Destination = EffectGroupDestination;

export interface VideoRoute {
    id: string;
    name: string;

    transform?: number[];
    edgeblend?: number[];
    perspective?: number[];

    source: Source;
    destination: Destination;

    enabled: boolean;
    metadata?: Record<string, unknown>;
}

export interface VideoRoutesService {
    get(id: string): VideoRoute | null;
    list(): VideoRoute[];
    create(data: Omit<VideoRoute, 'id'>): VideoRoute;
    update(data: VideoRoute): Promise<void>;
    delete(id: string): Promise<void>;
    setEnabled(id: string, enabled: boolean): void;
}
