import React from 'react';
import {
    Box,
    Button,
    Card,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

export type RecordData = Record<string, any>;

export type FieldDef =
    | { key: string; label: string; type: 'string' | 'number' | 'integer' | 'boolean' }
    | { key: string; label: string; type: 'enum'; options: readonly (string | number)[] }
    | { key: string; label: string; type: 'object'; fields: FieldDef[] }
    | { key: string; label: string; type: 'array'; itemLabel: string; fields: FieldDef[] };

const SCALAR_TYPES = ['string', 'number', 'integer', 'boolean', 'enum'];
const isScalar = (def: FieldDef): boolean => SCALAR_TYPES.includes(def.type);

interface ScalarFieldProps {
    def: Extract<FieldDef, {type: 'string' | 'number' | 'integer' | 'boolean' | 'enum'}>;
    value: any;
    onChange: (value: any) => void;
}

export const ScalarField: React.FC<ScalarFieldProps> = ({def, value, onChange}) => {
    if (def.type === 'boolean')
        return (
            <FormControlLabel
                control={
                    <Switch checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
                }
                label={def.label}
                sx={{m: 0}}
            />
        );

    if (def.type === 'enum')
        return (
            <FormControl size="small" fullWidth>
                <InputLabel>{def.label}</InputLabel>
                <Select
                    label={def.label}
                    value={value ?? ''}
                    onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
                >
                    <MenuItem value=""><em>(default)</em></MenuItem>
                    {def.options.map((opt) => (
                        <MenuItem key={String(opt)} value={opt}>{String(opt)}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        );

    if (def.type === 'number' || def.type === 'integer') {
        const isInt = def.type === 'integer';
        return (
            <TextField
                label={def.label}
                size="small"
                type="number"
                fullWidth
                value={value ?? ''}
                inputProps={isInt ? {step: 1} : {step: 'any'}}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') return onChange(undefined);
                    const n = Number(raw);
                    if (!Number.isFinite(n)) return onChange(undefined);
                    onChange(isInt ? Math.round(n) : n);
                }}
            />
        );
    }

    return (
        <TextField
            label={def.label}
            size="small"
            fullWidth
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        />
    );
};

const ScalarGrid: React.FC<{
    fields: FieldDef[];
    data: RecordData;
    onChange: (key: string, value: any) => void;
}> = ({fields, data, onChange}) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 1.5,
        }}
    >
        {fields.map((def) => (
            <ScalarField
                key={def.key}
                def={def as any}
                value={data[def.key]}
                onChange={(v) => onChange(def.key, v)}
            />
        ))}
    </Box>
);

interface ObjectFieldProps {
    def: Extract<FieldDef, {type: 'object'}>;
    value: RecordData | undefined;
    onChange: (value: RecordData | undefined) => void;
}

const ObjectField: React.FC<ObjectFieldProps> = ({def, value, onChange}) => {
    const data = value ?? {};
    const update = (key: string, v: any) => {
        const next = {...data, [key]: v};
        // If user clears every field, drop the whole object back to undefined
        // so the XML serializer doesn't emit an empty <subregion/> element.
        const isEmpty = Object.values(next).every((x) => x === undefined || x === '');
        onChange(isEmpty ? undefined : next);
    };

    return (
        <Card variant="outlined" sx={(theme) => ({p: 2, bgcolor: theme.palette.surface.elevated})}>
            <Stack spacing={1.5}>
                <Typography variant="h4">{def.label}</Typography>
                <Fields fields={def.fields} data={data} onChange={update} />
            </Stack>
        </Card>
    );
};

interface ArrayFieldProps {
    def: Extract<FieldDef, {type: 'array'}>;
    value: RecordData[] | undefined;
    onChange: (value: RecordData[]) => void;
}

const ArrayField: React.FC<ArrayFieldProps> = ({def, value, onChange}) => {
    const items = value ?? [];

    const updateItem = (i: number, key: string, v: any) =>
        onChange(items.map((item, idx) => idx === i ? {...item, [key]: v} : item));
    const removeItem = (i: number) => onChange(items.filter((_, idx) => idx !== i));
    const addItem = () => onChange([...items, {}]);

    return (
        <Card variant="outlined" sx={(theme) => ({p: 2, bgcolor: theme.palette.surface.elevated})}>
            <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h4">{def.label}</Typography>
                    <Button size="small" startIcon={<AddRoundedIcon />} onClick={addItem}>
                        Add {def.itemLabel.toLowerCase()}
                    </Button>
                </Stack>
                {items.length === 0 && (
                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                        No {def.itemLabel.toLowerCase()}s configured.
                    </Typography>
                )}
                {items.map((item, i) => (
                    <Card key={i} sx={(theme) => ({p: 2, bgcolor: theme.palette.surface.paper})}>
                        <Stack spacing={1.5}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="body1">
                                    {def.itemLabel} {i + 1}
                                </Typography>
                                <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => removeItem(i)}>
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Fields
                                fields={def.fields}
                                data={item}
                                onChange={(k, v) => updateItem(i, k, v)}
                            />
                        </Stack>
                    </Card>
                ))}
            </Stack>
        </Card>
    );
};

interface FieldsProps {
    fields: FieldDef[];
    data: RecordData;
    onChange: (key: string, value: any) => void;
}

export const Fields: React.FC<FieldsProps> = ({fields, data, onChange}) => {
    const scalars = fields.filter(isScalar);
    const nested = fields.filter((f) => !isScalar(f));
    return (
        <Stack spacing={2}>
            {scalars.length > 0 && (
                <ScalarGrid fields={scalars} data={data} onChange={onChange} />
            )}
            {nested.map((def) =>
                def.type === 'object' ? (
                    <ObjectField
                        key={def.key}
                        def={def}
                        value={data[def.key]}
                        onChange={(v) => onChange(def.key, v)}
                    />
                ) : def.type === 'array' ? (
                    <ArrayField
                        key={def.key}
                        def={def}
                        value={data[def.key]}
                        onChange={(v) => onChange(def.key, v)}
                    />
                ) : null,
            )}
        </Stack>
    );
};

export const CONSUMER_TYPES = [
    'decklink',
    'bluefish',
    'screen',
    'system-audio',
    'ndi',
    'ffmpeg',
    'artnet',
] as const;
export type ConsumerType = typeof CONSUMER_TYPES[number];

const SUBREGION_FIELDS: FieldDef[] = [
    {key: 'srcX', label: 'Src X', type: 'number'},
    {key: 'srcY', label: 'Src Y', type: 'number'},
    {key: 'destX', label: 'Dest X', type: 'number'},
    {key: 'destY', label: 'Dest Y', type: 'number'},
    {key: 'width', label: 'Width', type: 'number'},
    {key: 'height', label: 'Height', type: 'number'},
];

const DECKLINK_PORT_FIELDS: FieldDef[] = [
    {key: 'device', label: 'Device', type: 'number'},
    {key: 'keyOnly', label: 'Key only', type: 'boolean'},
    {key: 'videoMode', label: 'Video mode', type: 'string'},
    {key: 'subregion', label: 'Subregion', type: 'object', fields: SUBREGION_FIELDS},
];

export const ARTNET_FIXTURE_FIELDS: FieldDef[] = [
    {key: 'type', label: 'Type', type: 'enum', options: ['DIMMER', 'RGB', 'RGBW']},
    {key: 'startAddress', label: 'Start address', type: 'number'},
    {key: 'fixtureCount', label: 'Count (N or WxH)', type: 'string'},
    {key: 'fixtureChannels', label: 'Channels per fixture', type: 'number'},
    {key: 'left', label: 'Left', type: 'number'},
    {key: 'top', label: 'Top', type: 'number'},
    {key: 'width', label: 'Width', type: 'number'},
    {key: 'height', label: 'Height', type: 'number'},
    {
        key: 'flux',
        label: 'Flux',
        type: 'object',
        fields: [
            {key: 'r', label: 'R', type: 'number'},
            {key: 'g', label: 'G', type: 'number'},
            {key: 'b', label: 'B', type: 'number'},
            {key: 'w', label: 'W', type: 'number'},
        ],
    },
];

// Host/port/refresh-rate only — universes is handled by the artnet editor
// directly (chip input), since the generic FieldDef system doesn't model
// arrays of primitives.
export const ARTNET_SCALAR_FIELDS: FieldDef[] = [
    {key: 'host', label: 'Host', type: 'string'},
    {key: 'port', label: 'Port', type: 'number'},
    {key: 'refreshRate', label: 'Refresh rate', type: 'number'},
];

const DECKLINK_FIELDS: FieldDef[] = [
    {key: 'device', label: 'Device', type: 'number'},
    {key: 'keyDevice', label: 'Key device', type: 'number'},
    {key: 'embeddedAudio', label: 'Embedded audio', type: 'boolean'},
    {key: 'latency', label: 'Latency', type: 'enum', options: ['normal', 'low', 'default']},
    {key: 'keyer', label: 'Keyer', type: 'enum',
        options: ['external', 'external_separate_device', 'internal', 'default']},
    {key: 'keyOnly', label: 'Key only', type: 'boolean'},
    {key: 'bufferDepth', label: 'Buffer depth', type: 'number'},
    {key: 'videoMode', label: 'Video mode', type: 'string'},
    {key: 'waitForReference', label: 'Wait for ref', type: 'enum', options: ['auto', 'enable', 'disable']},
    {key: 'waitForReferenceDuration', label: 'Wait for ref duration', type: 'number'},
    {key: 'subregion', label: 'Subregion', type: 'object', fields: SUBREGION_FIELDS},
    {key: 'ports', label: 'Ports', type: 'array', itemLabel: 'Port', fields: DECKLINK_PORT_FIELDS},
];

const BLUEFISH_FIELDS: FieldDef[] = [
    {key: 'device', label: 'Device', type: 'number'},
    {key: 'embeddedAudio', label: 'Embedded audio', type: 'boolean'},
    {key: 'keyer', label: 'Keyer', type: 'enum', options: ['external', 'internal', 'disabled']},
    {key: 'internalKeyerAudioSource', label: 'Internal keyer audio',
        type: 'enum', options: ['videooutputchannel', 'sdivideoinput']},
    {key: 'watchdog', label: 'Watchdog', type: 'number'},
    {key: 'uhdMode', label: 'UHD mode', type: 'enum', options: [0, 1, 2, 3]},
];

const SYSTEM_AUDIO_FIELDS: FieldDef[] = [
    {key: 'channelLayout', label: 'Channel layout', type: 'enum', options: ['mono', 'stereo', 'matrix']},
    {key: 'latency', label: 'Latency', type: 'number'},
];

const SCREEN_FIELDS: FieldDef[] = [
    {key: 'device', label: 'Device', type: 'number'},
    {key: 'aspectRatio', label: 'Aspect ratio', type: 'enum', options: ['4:3', '16:9', 'default']},
    {key: 'stretch', label: 'Stretch', type: 'enum', options: ['fill', 'uniform', 'uniform_to_fill', 'none']},
    {key: 'windowed', label: 'Windowed', type: 'boolean'},
    {key: 'borderless', label: 'Borderless', type: 'boolean'},
    {key: 'interactive', label: 'Interactive', type: 'boolean'},
    {key: 'alwaysOnTop', label: 'Always on top', type: 'boolean'},
    {key: 'keyOnly', label: 'Key only', type: 'boolean'},
    {key: 'vsync', label: 'VSync', type: 'boolean'},
    {key: 'sbsKey', label: 'SBS key', type: 'boolean'},
    {key: 'x', label: 'X', type: 'number'},
    {key: 'y', label: 'Y', type: 'number'},
    {key: 'width', label: 'Width', type: 'number'},
    {key: 'height', label: 'Height', type: 'number'},
    {key: 'colourSpace', label: 'Colour space', type: 'enum',
        options: ['RGB', 'datavideo-full', 'datavideo-limited']},
];

const NDI_FIELDS: FieldDef[] = [
    {key: 'name', label: 'Name', type: 'string'},
    {key: 'allowFields', label: 'Allow fields', type: 'boolean'},
];

const FFMPEG_FIELDS: FieldDef[] = [
    {key: 'path', label: 'Path', type: 'string'},
    {key: 'args', label: 'Args', type: 'string'},
];

const ARTNET_FIELDS: FieldDef[] = [
    ...ARTNET_SCALAR_FIELDS,
    {key: 'fixtures', label: 'Fixtures', type: 'array', itemLabel: 'Fixture', fields: ARTNET_FIXTURE_FIELDS},
];

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
    type.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
