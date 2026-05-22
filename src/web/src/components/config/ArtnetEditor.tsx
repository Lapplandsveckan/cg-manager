import React, {useState} from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Autocomplete,
    Button,
    Card,
    Chip,
    FormControlLabel,
    IconButton,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {useStoredBoolean} from '../../lib/hooks/useStoredBoolean';
import {ArtnetCanvas, Fixture} from './ArtnetCanvas';
import {ARTNET_SCALAR_FIELDS, Fields, FieldDef, RecordData, ScalarField} from './fields';

interface ArtnetData extends RecordData {
    universes?: number[];
    fixtures?: Fixture[];
}

interface ArtnetEditorProps {
    data: ArtnetData;
    canvasWidth: number;
    canvasHeight: number;
    /** 1-based CG channel to stream as the stage backdrop. Falsy disables. */
    previewChannel?: number | null;
    onChange: (data: ArtnetData) => void;
}

const PREVIEW_PREF_KEY = 'artnet-editor-preview';

const newFixture = (canvasWidth: number, canvasHeight: number): Fixture => ({
    type: 'RGB',
    startAddress: 1,
    fixtureCount: '1',
    fixtureChannels: 3,
    flux: {r: 1, g: 1, b: 1, w: 1},
    left: Math.round(canvasWidth / 2 - 100),
    top: Math.round(canvasHeight / 2 - 50),
    width: 200,
    height: 100,
});

const fixtureSummary = (fixture: Fixture, index: number): string => {
    const type = fixture.type ?? '—';
    const count = fixture.fixtureCount ?? '1';
    const start = fixture.startAddress ?? 1;
    return `${index + 1}. ${type} × ${count} · DMX ${start}`;
};

export const ArtnetEditor: React.FC<ArtnetEditorProps> = ({
    data, canvasWidth, canvasHeight, previewChannel, onChange,
}) => {
    const fixtures = data.fixtures ?? [];
    const [selected, setSelected] = useState<number | null>(null);
    const [showPreview, setShowPreview] = useStoredBoolean(PREVIEW_PREF_KEY, false);

    const updateData = (key: string, value: any) => onChange({...data, [key]: value});

    const updateFixture = (i: number, key: string, value: any) => {
        const next = fixtures.map((f, idx) => idx === i ? {...f, [key]: value} : f);
        onChange({...data, fixtures: next});
    };

    const updateFixtures = (next: Fixture[]) => onChange({...data, fixtures: next});

    const addFixture = () => {
        const next = [...fixtures, newFixture(canvasWidth, canvasHeight)];
        onChange({...data, fixtures: next});
        setSelected(next.length - 1);
    };

    const removeFixture = (i: number) => {
        const next = fixtures.filter((_, idx) => idx !== i);
        onChange({...data, fixtures: next});
        if (selected === i) setSelected(null);
        else if (selected !== null && selected > i) setSelected(selected - 1);
    };

    const selectedFixture = selected !== null ? fixtures[selected] : null;

    return (
        <Stack spacing={3}>
            <Card variant="outlined" sx={(theme) => ({p: 2, bgcolor: theme.palette.surface.elevated})}>
                <Stack spacing={2}>
                    <Typography variant="h4">Output</Typography>
                    <UniversesInput
                        universes={data.universes ?? []}
                        onChange={(next) => onChange({...data, universes: next})}
                    />
                    <Fields
                        fields={ARTNET_SCALAR_FIELDS}
                        data={data}
                        onChange={updateData}
                    />
                </Stack>
            </Card>

            <Stack direction={{xs: 'column', lg: 'row'}} gap={3} alignItems="flex-start">
                <Stack spacing={1} sx={{minWidth: 0, flex: 1}}>
                    {previewChannel != null && (
                        <Stack direction="row" justifyContent="flex-end">
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showPreview}
                                        onChange={(e) => setShowPreview(e.target.checked)}
                                    />
                                }
                                label={<Typography variant="caption">Live preview · ch {previewChannel}</Typography>}
                                labelPlacement="start"
                                sx={{m: 0, '& .MuiFormControlLabel-label': {color: 'text.secondary'}}}
                            />
                        </Stack>
                    )}
                    <ArtnetCanvas
                        fixtures={fixtures}
                        canvasWidth={canvasWidth}
                        canvasHeight={canvasHeight}
                        selectedIndex={selected}
                        onSelect={setSelected}
                        onChange={updateFixtures}
                        previewChannel={showPreview ? previewChannel : null}
                    />
                </Stack>

                <Stack spacing={2} sx={{width: {xs: '100%', lg: 480}, flexShrink: 0}}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="h4">Fixtures</Typography>
                        <Button size="small" startIcon={<AddRoundedIcon />} onClick={addFixture}>
                            Add
                        </Button>
                    </Stack>

                    {fixtures.length === 0 ? (
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            No fixtures yet — click <em>Add</em> to drop one on the stage.
                        </Typography>
                    ) : (
                        <Stack spacing={0.5}>
                            {fixtures.map((fixture, i) => (
                                <FixtureRow
                                    key={i}
                                    label={fixtureSummary(fixture, i)}
                                    selected={i === selected}
                                    onSelect={() => setSelected(i)}
                                    onDelete={() => removeFixture(i)}
                                />
                            ))}
                        </Stack>
                    )}

                    {selectedFixture && selected !== null && (
                        <FixtureDetails
                            index={selected}
                            fixture={selectedFixture}
                            onChange={(k, v) => updateFixture(selected, k, v)}
                            onDelete={() => removeFixture(selected)}
                        />
                    )}
                </Stack>
            </Stack>
        </Stack>
    );
};

const TYPE_FIELD: FieldDef = {
    key: 'type',
    label: 'Type',
    type: 'enum',
    options: ['DIMMER', 'RGB', 'RGBW'],
};
const START_ADDRESS_FIELD: FieldDef = {key: 'startAddress', label: 'Start address', type: 'integer'};
const CHANNELS_FIELD: FieldDef = {key: 'fixtureChannels', label: 'Channels / fixture', type: 'integer'};
const LEFT_FIELD: FieldDef = {key: 'left', label: 'Left', type: 'integer'};
const TOP_FIELD: FieldDef = {key: 'top', label: 'Top', type: 'integer'};
const WIDTH_FIELD: FieldDef = {key: 'width', label: 'Width', type: 'integer'};
const HEIGHT_FIELD: FieldDef = {key: 'height', label: 'Height', type: 'integer'};
const FLUX_FIELDS: FieldDef[] = [
    {key: 'r', label: 'R', type: 'number'},
    {key: 'g', label: 'G', type: 'number'},
    {key: 'b', label: 'B', type: 'number'},
    {key: 'w', label: 'W', type: 'number'},
];

interface FixtureDetailsProps {
    index: number;
    fixture: Fixture;
    onChange: (key: string, value: any) => void;
    onDelete: () => void;
}

const FixtureDetails: React.FC<FixtureDetailsProps> = ({index, fixture, onChange, onDelete}) => {
    const flux = (fixture.flux ?? {}) as Record<string, number | undefined>;
    const updateFlux = (k: string, v: any) => {
        const next = {...flux, [k]: v};
        const isEmpty = Object.values(next).every((x) => x === undefined || x === '');
        onChange('flux', isEmpty ? undefined : next);
    };

    return (
        <Card variant="outlined" sx={(theme) => ({p: 2, bgcolor: theme.palette.surface.elevated})}>
            <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body1">Fixture {index + 1}</Typography>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={onDelete}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <ScalarField def={TYPE_FIELD as any} value={fixture.type} onChange={(v) => onChange('type', v)} />

                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={START_ADDRESS_FIELD as any}
                        value={fixture.startAddress}
                        onChange={(v) => onChange('startAddress', v)}
                    />
                    <ScalarField
                        def={CHANNELS_FIELD as any}
                        value={fixture.fixtureChannels}
                        onChange={(v) => onChange('fixtureChannels', v)}
                    />
                </Stack>

                <FixtureCountInput
                    value={fixture.fixtureCount}
                    onChange={(v) => onChange('fixtureCount', v)}
                />

                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={LEFT_FIELD as any}
                        value={fixture.left}
                        onChange={(v) => onChange('left', v)}
                    />
                    <ScalarField
                        def={TOP_FIELD as any}
                        value={fixture.top}
                        onChange={(v) => onChange('top', v)}
                    />
                </Stack>
                <Stack direction="row" gap={1.5}>
                    <ScalarField
                        def={WIDTH_FIELD as any}
                        value={fixture.width}
                        onChange={(v) => onChange('width', v)}
                    />
                    <ScalarField
                        def={HEIGHT_FIELD as any}
                        value={fixture.height}
                        onChange={(v) => onChange('height', v)}
                    />
                </Stack>

                <Accordion
                    disableGutters
                    elevation={0}
                    sx={(theme) => ({
                        bgcolor: 'transparent',
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        '&::before': {display: 'none'},
                    })}
                >
                    <AccordionSummary
                        expandIcon={<ExpandMoreRoundedIcon fontSize="small" />}
                        sx={{minHeight: 36, '& .MuiAccordionSummary-content': {my: 0.5}}}
                    >
                        <Typography variant="body2">Advanced</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Stack spacing={1}>
                            <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                Flux — per-channel brightness multiplier (0–1).
                            </Typography>
                            <Stack direction="row" gap={1.5}>
                                {FLUX_FIELDS.map((def) => (
                                    <ScalarField
                                        key={def.key}
                                        def={def as any}
                                        value={flux[def.key]}
                                        onChange={(v) => updateFlux(def.key, v)}
                                    />
                                ))}
                            </Stack>
                        </Stack>
                    </AccordionDetails>
                </Accordion>
            </Stack>
        </Card>
    );
};

const parseCount = (str: string | undefined): {w: number; h: number} => {
    if (!str) return {w: 1, h: 1};
    const m = String(str).match(/^(\d+)(?:x(\d+))?$/i);
    if (!m) return {w: 1, h: 1};
    return {w: parseInt(m[1], 10) || 1, h: m[2] ? parseInt(m[2], 10) || 1 : 1};
};

// "10x1" round-trips back to "10" so we don't churn the user's existing
// data unnecessarily — the strip form (`N`) and the 1-tall grid form
// (`Nx1`) are equivalent to CasparCG.
const formatCount = (w: number, h: number): string => {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    return H === 1 ? String(W) : `${W}x${H}`;
};

interface FixtureCountInputProps {
    value: string | undefined;
    onChange: (value: string) => void;
}

const FixtureCountInput: React.FC<FixtureCountInputProps> = ({value, onChange}) => {
    const {w, h} = parseCount(value);
    return (
        <Stack direction="row" gap={1.5}>
            <TextField
                label="Count W"
                size="small"
                type="number"
                fullWidth
                value={w}
                inputProps={{step: 1, min: 1}}
                onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    onChange(formatCount(Number.isFinite(n) ? n : 1, h));
                }}
            />
            <TextField
                label="Count H"
                size="small"
                type="number"
                fullWidth
                value={h}
                inputProps={{step: 1, min: 1}}
                onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    onChange(formatCount(w, Number.isFinite(n) ? n : 1));
                }}
            />
        </Stack>
    );
};

interface FixtureRowProps {
    label: string;
    selected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

const FixtureRow: React.FC<FixtureRowProps> = ({label, selected, onSelect, onDelete}) => (
    <Card
        variant="outlined"
        onClick={onSelect}
        sx={(theme) => ({
            p: 1,
            cursor: 'pointer',
            bgcolor: selected
                ? alpha(theme.palette.primary.main, 0.15)
                : theme.palette.surface.elevated,
            borderColor: selected ? theme.palette.primary.main : theme.palette.divider,
        })}
    >
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography
                variant="body2"
                sx={{fontFamily: 'monospace', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis'}}
            >
                {label}
            </Typography>
            <Tooltip title="Delete">
                <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
    </Card>
);

interface UniversesInputProps {
    universes: number[];
    onChange: (universes: number[]) => void;
}

// Parse a single token from the autocomplete input. Accepts a bare number
// ("3"), a comma/space-separated list ("0, 1, 2"), or a hyphen range ("0-3"
// inclusive), and combinations thereof ("0-2, 5"). Anything that isn't a
// finite integer is dropped silently.
const parseUniverseTokens = (raw: string): number[] => {
    const out: number[] = [];
    for (const tok of raw.split(/[\s,]+/).filter(Boolean)) {
        const range = tok.match(/^(\d+)-(\d+)$/);
        if (range) {
            const a = parseInt(range[1], 10);
            const b = parseInt(range[2], 10);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                const [lo, hi] = a <= b ? [a, b] : [b, a];
                for (let i = lo; i <= hi; i++) out.push(i);
            }
            continue;
        }
        const n = parseInt(tok, 10);
        if (Number.isFinite(n)) out.push(n);
    }
    return out;
};

const dedupeOrdered = (nums: number[]): number[] => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const n of nums) 
        if (!seen.has(n)) { seen.add(n); out.push(n); }
    
    return out;
};

const UniversesInput: React.FC<UniversesInputProps> = ({universes, onChange}) => (
    <Autocomplete
        multiple
        freeSolo
        autoSelect
        options={[] as string[]}
        value={universes.map(String)}
        onChange={(_, raw) => {
            // Each entry might be a single number string OR something the user
            // pasted ("0,1,2" / "0-3"). Flat-map through the parser, then
            // dedupe while preserving the order the user laid them out in.
            const parsed = raw.flatMap((v) => parseUniverseTokens(String(v)));
            onChange(dedupeOrdered(parsed));
        }}
        renderTags={(values, getTagProps) =>
            values.map((value, index) => (
                <Chip
                    key={index}
                    size="small"
                    label={value}
                    {...getTagProps({index})}
                />
            ))
        }
        renderInput={(params) => (
            <TextField
                {...params}
                size="small"
                label="Universes"
                placeholder={universes.length === 0 ? 'e.g. 0, 1, 2 or 0-3' : ''}
                helperText="Type numbers, paste lists, or ranges like 0-3"
            />
        )}
    />
);
