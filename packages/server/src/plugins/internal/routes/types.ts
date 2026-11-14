import { type Effect, type EffectGroup } from '@lappis/cg-manager';

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

/** A source type another plugin contributed. Its shape is the contributor's
 *  business; routes only ever reads `type`. */
export interface ContributedSource {
    type: string;
    [key: string]: unknown;
}

export type BuiltinSource =
    DecklinkSource | VideoSource | ChannelSource | ColorSource;
export type Source = BuiltinSource | ContributedSource;
export type Destination = EffectGroupDestination;

export const BUILTIN_SOURCE_TYPES: BuiltinSource['type'][] = [
    'decklink',
    'video',
    'channel',
    'color',
];

export const isBuiltinSourceType = (type: string) =>
    BUILTIN_SOURCE_TYPES.includes(type as BuiltinSource['type']);

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

export interface RouteSourceContext {
    group: EffectGroup;
    source: ContributedSource;
    route: VideoRoute;
}

/** What a plugin pushes into the `routes:source-types` contribution point to
 *  become a source a route can be built on. The matching editor UI is a
 *  separate `registerUI` into the `plugin:routes.source.<type>` zone, which
 *  receives `{ data, onChange }`. */
export interface RouteSourceType {
    type: string;
    /** Picker label: an i18next `ns:key` from the contributing plugin's own
     *  namespace, or a plain string. */
    label: string;
    description?: string;
    /** Rejecting here keeps a route that could never be built from being stored. */
    validate?(source: ContributedSource): boolean;
    createEffect(context: RouteSourceContext): Effect | null;
}

export interface VideoRoutesService {
    get(id: string): VideoRoute | null;
    list(): VideoRoute[];
    create(data: Omit<VideoRoute, 'id'>): VideoRoute;
    update(data: VideoRoute): Promise<void>;
    delete(id: string): Promise<void>;
    setEnabled(id: string, enabled: boolean): void;
}
