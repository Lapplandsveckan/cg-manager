import {
    CONSUMER_FIELDS,
    type ConsumerType,
    type FieldDef,
    type RecordData,
} from '../../components/config/fields';

// The set of consumer types a non-technical operator can create in simple
// mode. Bluefish and FFmpeg are advanced-only — an existing consumer of
// either type is still shown (read-only) rather than hidden. Typed as
// `readonly ConsumerType[]` rather than `as const` so removing a type from
// CONSUMER_TYPES is a compile error here too.
export const SIMPLE_CONSUMER_TYPES: readonly ConsumerType[] = [
    'screen',
    'decklink',
    'ndi',
    'system-audio',
    'artnet',
];

export const isSimpleConsumer = (type: string): boolean =>
    (SIMPLE_CONSUMER_TYPES as readonly string[]).includes(type);

// Allow-list, not a deny-list: a field only appears in simple mode if it's
// named here, so a new field added to consumerFields.ts is advanced-only by
// default instead of silently leaking into the guided surface. Order here is
// teaching order, not schema order. Artnet has no entry — ConsumerModal
// routes it to ArtnetEditor, so simpleFields('artnet') is computed but its
// result is never rendered.
export const SIMPLE_CONSUMER_FIELDS: Partial<Record<ConsumerType, string[]>> = {
    screen: ['device', 'windowed', 'alwaysOnTop'],
    decklink: ['device', 'embeddedAudio', 'keyer'],
    ndi: ['name'],
    'system-audio': ['channelLayout'],
};

// Resolves a type's simple field list against CONSUMER_FIELDS (the source of
// truth) and swaps in plain-language labels. An allow-listed key that no
// longer exists on the type is dropped rather than crashing.
export const simpleFields = (type: ConsumerType): FieldDef[] => {
    const allow = SIMPLE_CONSUMER_FIELDS[type];
    if (!allow) return CONSUMER_FIELDS[type];

    const byKey = new Map(CONSUMER_FIELDS[type].map(def => [def.key, def]));
    return allow.flatMap(key => {
        const def = byKey.get(key);
        if (!def) return [];
        return [{ ...def, label: `config.simple.fields.${type}.${key}` }];
    });
};

// Preset defaults applied when creating a consumer in simple mode, seeded
// into the modal's form state as soon as it opens so the operator sees
// sensible values rather than a blank form. The draft itself is untouched
// until the user presses Save, so opening and cancelling never dirties it.
export const SIMPLE_CONSUMER_DEFAULTS: Partial<
    Record<ConsumerType, RecordData>
> = {
    screen: { device: 1, windowed: false },
    decklink: { device: 1, embeddedAudio: true },
    ndi: { name: 'CasparCG' },
    'system-audio': { channelLayout: 'stereo' },
};

export interface ResolutionPreset {
    id: string;
    labelKey: string;
}

// Curated subset of BUILTIN_VIDEO_MODES for the simple resolution picker.
// The full 39-entry list lives behind the "Other…" escape hatch.
export const RESOLUTION_PRESETS: ResolutionPreset[] = [
    { id: '1080p5000', labelKey: 'config.simple.resolution.presets.1080p5000' },
    { id: '1080p6000', labelKey: 'config.simple.resolution.presets.1080p6000' },
    { id: '1080p2500', labelKey: 'config.simple.resolution.presets.1080p2500' },
    { id: '1080i5000', labelKey: 'config.simple.resolution.presets.1080i5000' },
    { id: '720p5000', labelKey: 'config.simple.resolution.presets.720p5000' },
    { id: '2160p5000', labelKey: 'config.simple.resolution.presets.2160p5000' },
    { id: '2160p6000', labelKey: 'config.simple.resolution.presets.2160p6000' },
];
