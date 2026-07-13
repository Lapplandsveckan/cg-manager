import type { FieldDef } from '../fields';

const F = 'config.fields';

const SUBREGION_FIELDS: FieldDef[] = [
    { key: 'srcX', label: `${F}.srcX`, type: 'number' },
    { key: 'srcY', label: `${F}.srcY`, type: 'number' },
    { key: 'destX', label: `${F}.destX`, type: 'number' },
    { key: 'destY', label: `${F}.destY`, type: 'number' },
    { key: 'width', label: `${F}.width`, type: 'number' },
    { key: 'height', label: `${F}.height`, type: 'number' },
];

const DECKLINK_PORT_FIELDS: FieldDef[] = [
    { key: 'device', label: `${F}.device`, type: 'number' },
    { key: 'keyOnly', label: `${F}.keyOnly`, type: 'boolean' },
    { key: 'videoMode', label: `${F}.videoMode`, type: 'string' },
    {
        key: 'subregion',
        label: `${F}.subregion`,
        type: 'object',
        fields: SUBREGION_FIELDS,
    },
];

// v2 (Lappis custom build) fixture fields — each fixture has its own connection.
export const ARTNET_FIXTURE_FIELDS: FieldDef[] = [
    { key: 'host', label: `${F}.host`, type: 'string' },
    { key: 'port', label: `${F}.port`, type: 'integer' },
    { key: 'universe', label: `${F}.universe`, type: 'integer' },
    {
        key: 'type',
        label: `${F}.type`,
        type: 'enum',
        options: ['DIMMER', 'RGB', 'RGBW'],
    },
    { key: 'startAddress', label: `${F}.startAddress`, type: 'number' },
    { key: 'fixtureCount', label: `${F}.fixtureCount`, type: 'string' },
    {
        key: 'fixtureChannels',
        label: `${F}.channelsPerFixture`,
        type: 'number',
    },
    { key: 'left', label: `${F}.left`, type: 'number' },
    { key: 'top', label: `${F}.top`, type: 'number' },
    { key: 'width', label: `${F}.width`, type: 'number' },
    { key: 'height', label: `${F}.height`, type: 'number' },
    {
        key: 'flux',
        label: `${F}.flux`,
        type: 'object',
        fields: [
            { key: 'r', label: 'R', type: 'number' },
            { key: 'g', label: 'G', type: 'number' },
            { key: 'b', label: 'B', type: 'number' },
            { key: 'w', label: 'W', type: 'number' },
        ],
    },
    { key: 'brightness', label: `${F}.brightness`, type: 'number' },
    { key: 'rotation', label: `${F}.rotation`, type: 'number' },
    { key: 'mirrorX', label: `${F}.mirrorX`, type: 'boolean' },
    { key: 'mirrorY', label: `${F}.mirrorY`, type: 'boolean' },
];

// Legacy (upstream CasparCG) output-level fields: host/port/refreshRate.
export const ARTNET_SCALAR_FIELDS: FieldDef[] = [
    { key: 'host', label: `${F}.host`, type: 'string' },
    { key: 'port', label: `${F}.port`, type: 'number' },
    { key: 'refreshRate', label: `${F}.refreshRate`, type: 'number' },
];

// v2 output-level fields: universe is per-fixture, so only refreshRate here.
export const ARTNET_V2_SCALAR_FIELDS: FieldDef[] = [
    { key: 'refreshRate', label: `${F}.refreshRate`, type: 'number' },
];

const DECKLINK_FIELDS: FieldDef[] = [
    { key: 'device', label: `${F}.device`, type: 'number' },
    { key: 'keyDevice', label: `${F}.keyDevice`, type: 'number' },
    { key: 'embeddedAudio', label: `${F}.embeddedAudio`, type: 'boolean' },
    {
        key: 'latency',
        label: `${F}.latency`,
        type: 'enum',
        options: ['normal', 'low', 'default'],
    },
    {
        key: 'keyer',
        label: `${F}.keyer`,
        type: 'enum',
        options: [
            'external',
            'external_separate_device',
            'internal',
            'default',
        ],
    },
    { key: 'keyOnly', label: `${F}.keyOnly`, type: 'boolean' },
    { key: 'bufferDepth', label: `${F}.bufferDepth`, type: 'number' },
    { key: 'videoMode', label: `${F}.videoMode`, type: 'string' },
    {
        key: 'duplex',
        label: `${F}.duplex`,
        type: 'enum',
        options: ['full', 'half', 'default'],
    },
    {
        key: 'waitForReference',
        label: `${F}.waitForReference`,
        type: 'enum',
        options: ['auto', 'enable', 'disable'],
    },
    {
        key: 'waitForReferenceDuration',
        label: `${F}.waitForReferenceDuration`,
        type: 'number',
    },
    {
        key: 'subregion',
        label: `${F}.subregion`,
        type: 'object',
        fields: SUBREGION_FIELDS,
    },
    {
        key: 'ports',
        label: `${F}.ports`,
        type: 'array',
        itemLabel: `${F}.port`,
        fields: DECKLINK_PORT_FIELDS,
    },
];

const BLUEFISH_FIELDS: FieldDef[] = [
    { key: 'device', label: `${F}.device`, type: 'number' },
    { key: 'embeddedAudio', label: `${F}.embeddedAudio`, type: 'boolean' },
    {
        key: 'keyer',
        label: `${F}.keyer`,
        type: 'enum',
        options: ['external', 'internal', 'disabled'],
    },
    {
        key: 'internalKeyerAudioSource',
        label: `${F}.internalKeyerAudioSource`,
        type: 'enum',
        options: ['videooutputchannel', 'sdivideoinput'],
    },
    { key: 'watchdog', label: `${F}.watchdog`, type: 'number' },
    {
        key: 'uhdMode',
        label: `${F}.uhdMode`,
        type: 'enum',
        options: [0, 1, 2, 3],
    },
];

const SYSTEM_AUDIO_FIELDS: FieldDef[] = [
    {
        key: 'channelLayout',
        label: `${F}.channelLayout`,
        type: 'enum',
        options: ['mono', 'stereo', 'matrix'],
    },
    { key: 'latency', label: `${F}.latency`, type: 'number' },
];

const SCREEN_FIELDS: FieldDef[] = [
    { key: 'device', label: `${F}.device`, type: 'number' },
    {
        key: 'aspectRatio',
        label: `${F}.aspectRatio`,
        type: 'enum',
        options: ['4:3', '16:9', 'default'],
    },
    {
        key: 'stretch',
        label: `${F}.stretch`,
        type: 'enum',
        options: ['fill', 'uniform', 'uniform_to_fill', 'none'],
    },
    { key: 'windowed', label: `${F}.windowed`, type: 'boolean' },
    { key: 'borderless', label: `${F}.borderless`, type: 'boolean' },
    { key: 'interactive', label: `${F}.interactive`, type: 'boolean' },
    { key: 'alwaysOnTop', label: `${F}.alwaysOnTop`, type: 'boolean' },
    { key: 'keyOnly', label: `${F}.keyOnly`, type: 'boolean' },
    { key: 'vsync', label: `${F}.vsync`, type: 'boolean' },
    { key: 'sbsKey', label: `${F}.sbsKey`, type: 'boolean' },
    { key: 'x', label: 'X', type: 'number' },
    { key: 'y', label: 'Y', type: 'number' },
    { key: 'width', label: `${F}.width`, type: 'number' },
    { key: 'height', label: `${F}.height`, type: 'number' },
    {
        key: 'colourSpace',
        label: `${F}.colourSpace`,
        type: 'enum',
        options: ['RGB', 'datavideo-full', 'datavideo-limited'],
    },
];

const NDI_FIELDS: FieldDef[] = [
    { key: 'name', label: `${F}.name`, type: 'string' },
    { key: 'allowFields', label: `${F}.allowFields`, type: 'boolean' },
];

const FFMPEG_FIELDS: FieldDef[] = [
    { key: 'path', label: `${F}.path`, type: 'string' },
    { key: 'args', label: `${F}.args`, type: 'string' },
];

// Generic fallback shape for artnet (v2 profile). Not used for rendering since
// ConsumerModal routes artnet to the custom ArtnetEditor, but kept coherent.
const ARTNET_FIELDS: FieldDef[] = [
    ...ARTNET_V2_SCALAR_FIELDS,
    {
        key: 'fixtures',
        label: `${F}.fixtures`,
        type: 'array',
        itemLabel: `${F}.fixture`,
        fields: ARTNET_FIXTURE_FIELDS,
    },
];

export const CONSUMER_TYPES = [
    'decklink',
    'bluefish',
    'screen',
    'system-audio',
    'ndi',
    'ffmpeg',
    'artnet',
] as const;
export type ConsumerType = (typeof CONSUMER_TYPES)[number];

export const CONSUMER_FIELDS: Record<ConsumerType, FieldDef[]> = {
    decklink: DECKLINK_FIELDS,
    bluefish: BLUEFISH_FIELDS,
    'system-audio': SYSTEM_AUDIO_FIELDS,
    screen: SCREEN_FIELDS,
    ndi: NDI_FIELDS,
    ffmpeg: FFMPEG_FIELDS,
    artnet: ARTNET_FIELDS,
};

export const formatConsumerType = (type: string) =>
    type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
