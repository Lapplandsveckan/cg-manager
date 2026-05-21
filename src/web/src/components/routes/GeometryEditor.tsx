import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
    Box,
    Button,
    Card,
    Modal,
    Slider,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import {GeometryStage} from './GeometryStage';
import {
    EdgeBlendHandles,
    EdgeBlendInsets,
    NormRect,
    Perspective,
    PerspectiveHandles,
    RectHandles,
} from './GeometryHandles';

export interface GeometryValues {
    /** 8 numbers: source rect [x1,y1,x2,y2], destination rect [x1,y1,x2,y2]. */
    transform?: number[];
    /** 8 numbers: TL.x, TL.y, TR.x, TR.y, BR.x, BR.y, BL.x, BL.y. */
    perspective?: number[];
    /** 7 numbers: left, right, top, bottom edge-inset widths (each 0..1
     *  measured from that edge inward), then gamma, power, alpha. Maps
     *  directly onto the CasparCG `MIXER EDGEBLEND` AMCP command. */
    edgeblend?: number[];
}

interface GeometryEditorProps {
    open: boolean;
    value: GeometryValues;
    canvasWidth: number;
    canvasHeight: number;
    onClose: () => void;
    onSave: (value: GeometryValues) => void;
}

const IDENTITY_RECT: NormRect = {x: 0, y: 0, w: 1, h: 1};
const IDENTITY_QUAD: Perspective = {
    tl: {x: 0, y: 0},
    tr: {x: 1, y: 0},
    br: {x: 1, y: 1},
    bl: {x: 0, y: 1},
};
const ZERO_INSETS: EdgeBlendInsets = {left: 0, right: 0, top: 0, bottom: 0};

function rectFromArr(arr: number[] | undefined, offset: number, fallback: NormRect): NormRect {
    if (!arr || arr.length < offset + 4) return {...fallback};
    const [x1, y1, x2, y2] = arr.slice(offset, offset + 4);
    return {x: x1, y: y1, w: x2 - x1, h: y2 - y1};
}

function arrFromRect(r: NormRect): number[] {
    return [r.x, r.y, r.x + r.w, r.y + r.h];
}

function quadFromArr(arr: number[] | undefined): Perspective {
    if (!arr || arr.length < 8) return {...IDENTITY_QUAD};
    return {
        tl: {x: arr[0], y: arr[1]},
        tr: {x: arr[2], y: arr[3]},
        br: {x: arr[4], y: arr[5]},
        bl: {x: arr[6], y: arr[7]},
    };
}

function arrFromQuad(q: Perspective): number[] {
    return [q.tl.x, q.tl.y, q.tr.x, q.tr.y, q.br.x, q.br.y, q.bl.x, q.bl.y];
}

function insetsFromArr(arr: number[] | undefined): EdgeBlendInsets {
    if (!arr || arr.length < 4) return {...ZERO_INSETS};
    return {left: arr[0], right: arr[1], top: arr[2], bottom: arr[3]};
}

function isIdentityRect(r: NormRect): boolean {
    return r.x === 0 && r.y === 0 && r.w === 1 && r.h === 1;
}

function isIdentityQuad(q: Perspective): boolean {
    return q.tl.x === 0 && q.tl.y === 0
        && q.tr.x === 1 && q.tr.y === 0
        && q.br.x === 1 && q.br.y === 1
        && q.bl.x === 0 && q.bl.y === 1;
}

function isZeroInsets(i: EdgeBlendInsets): boolean {
    return i.left === 0 && i.right === 0 && i.top === 0 && i.bottom === 0;
}

type Tabkey = 'position' | 'perspective' | 'edgeblend';

export const GeometryEditor: React.FC<GeometryEditorProps> = ({
    open,
    value,
    canvasWidth,
    canvasHeight,
    onClose,
    onSave,
}) => {
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [tab, setTab] = useState<Tabkey>('position');

    const [destRect, setDestRect] = useState<NormRect>(IDENTITY_RECT);
    const [srcRect, setSrcRect] = useState<NormRect>(IDENTITY_RECT);
    const [quad, setQuad] = useState<Perspective>(IDENTITY_QUAD);
    const [insets, setInsets] = useState<EdgeBlendInsets>(ZERO_INSETS);
    const [gamma, setGamma] = useState(1.8);
    const [power, setPower] = useState(3.0);
    const [alpha, setAlpha] = useState(0.5);

    useEffect(() => {
        if (!open) return;
        setSrcRect(rectFromArr(value.transform, 0, IDENTITY_RECT));
        setDestRect(rectFromArr(value.transform, 4, IDENTITY_RECT));
        setQuad(quadFromArr(value.perspective));
        setInsets(insetsFromArr(value.edgeblend));
        const eb = value.edgeblend;
        setGamma(eb?.[4] ?? 1.8);
        setPower(eb?.[5] ?? 3.0);
        setAlpha(eb?.[6] ?? 0.5);
    }, [open, value]);

    const handleSave = () => {
        const next: GeometryValues = {};
        if (!isIdentityRect(srcRect) || !isIdentityRect(destRect))
            next.transform = [...arrFromRect(srcRect), ...arrFromRect(destRect)];
        if (!isIdentityQuad(quad))
            next.perspective = arrFromQuad(quad);
        if (!isZeroInsets(insets))
            next.edgeblend = [insets.left, insets.right, insets.top, insets.bottom, gamma, power, alpha];
        onSave(next);
        onClose();
    };

    const resetCurrentTab = () => {
        if (tab === 'position') { setSrcRect(IDENTITY_RECT); setDestRect(IDENTITY_RECT); }
        if (tab === 'perspective') setQuad(IDENTITY_QUAD);
        if (tab === 'edgeblend') {
            setInsets(ZERO_INSETS);
            setGamma(1.8); setPower(3.0); setAlpha(0.5);
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(1200px, 95vw)',
                    maxHeight: '95vh',
                    overflowY: 'auto',
                }}
            >
                <Card sx={{p: 3}}>
                    <Stack spacing={2}>
                        <Stack direction="row" alignItems="baseline" justifyContent="space-between" gap={2}>
                            <Stack spacing={0.5}>
                                <Typography variant="h3">Geometry</Typography>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                    Drag handles to position, warp, or blend the route output.
                                    Coordinates are normalized (0..1) — they survive resolution
                                    changes on the destination channel.
                                </Typography>
                            </Stack>
                            <Typography variant="caption" sx={{color: 'text.disabled', fontFamily: 'monospace'}}>
                                {canvasWidth}×{canvasHeight}
                            </Typography>
                        </Stack>

                        <Tabs value={tab} onChange={(_, v) => setTab(v as Tabkey)}>
                            <Tab value="position" label="Position" />
                            <Tab value="perspective" label="Perspective" />
                            <Tab value="edgeblend" label="Edge blend" />
                        </Tabs>

                        <Box ref={stageRef} sx={{position: 'relative'}}>
                            <GeometryStage canvasWidth={canvasWidth} canvasHeight={canvasHeight}>
                                {({width, height}) => (
                                    <StageContent
                                        tab={tab}
                                        stageRef={stageRef}
                                        width={width}
                                        height={height}
                                        destRect={destRect}
                                        quad={quad}
                                        insets={insets}
                                        setDestRect={setDestRect}
                                        setQuad={setQuad}
                                        setInsets={setInsets}
                                    />
                                )}
                            </GeometryStage>
                        </Box>

                        <TabControls
                            tab={tab}
                            srcRect={srcRect}
                            destRect={destRect}
                            quad={quad}
                            insets={insets}
                            gamma={gamma}
                            power={power}
                            alpha={alpha}
                            setGamma={setGamma}
                            setPower={setPower}
                            setAlpha={setAlpha}
                        />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Button color="inherit" onClick={resetCurrentTab}>
                                Reset this tab
                            </Button>
                            <Stack direction="row" gap={1}>
                                <Button onClick={onClose} color="inherit">Cancel</Button>
                                <Button onClick={handleSave} variant="contained">Save</Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            </Box>
        </Modal>
    );
};

interface StageContentProps {
    tab: Tabkey;
    stageRef: React.RefObject<HTMLElement | null>;
    width: number;
    height: number;
    destRect: NormRect;
    quad: Perspective;
    insets: EdgeBlendInsets;
    setDestRect: (r: NormRect) => void;
    setQuad: (q: Perspective) => void;
    setInsets: (i: EdgeBlendInsets) => void;
}

const StageContent: React.FC<StageContentProps> = ({
    tab, stageRef, width, height,
    destRect, quad, insets,
    setDestRect, setQuad, setInsets,
}) => {
    if (tab === 'position') return (
        <RectHandles
            rect={destRect}
            onChange={setDestRect}
            width={width}
            height={height}
            stageRef={stageRef}
            label="FILL"
        />
    );
    if (tab === 'perspective') return (
        <PerspectiveHandles
            quad={quad}
            onChange={setQuad}
            width={width}
            height={height}
            stageRef={stageRef}
        />
    );
    if (tab === 'edgeblend') return (
        <EdgeBlendHandles
            insets={insets}
            onChange={setInsets}
            width={width}
            height={height}
            stageRef={stageRef}
        />
    );
    return null;
};

interface TabControlsProps {
    tab: Tabkey;
    srcRect: NormRect;
    destRect: NormRect;
    quad: Perspective;
    insets: EdgeBlendInsets;
    gamma: number;
    power: number;
    alpha: number;
    setGamma: (v: number) => void;
    setPower: (v: number) => void;
    setAlpha: (v: number) => void;
}

const formatRect = (r: NormRect) =>
    `x ${r.x.toFixed(3)}  y ${r.y.toFixed(3)}  w ${r.w.toFixed(3)}  h ${r.h.toFixed(3)}`;

const formatPoint = (p: {x: number; y: number}) =>
    `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`;

const TabControls: React.FC<TabControlsProps> = ({
    tab, srcRect, destRect, quad, insets,
    gamma, power, alpha,
    setGamma, setPower, setAlpha,
}) => {
    const readout = useMemo(() => {
        if (tab === 'position') return [
            {label: 'Destination (FILL)', value: formatRect(destRect)},
            {label: 'Source (CLIP)', value: formatRect(srcRect)},
        ];
        if (tab === 'perspective') return [
            {label: 'Top-left',     value: formatPoint(quad.tl)},
            {label: 'Top-right',    value: formatPoint(quad.tr)},
            {label: 'Bottom-right', value: formatPoint(quad.br)},
            {label: 'Bottom-left',  value: formatPoint(quad.bl)},
        ];
        return [
            {label: 'Left',   value: insets.left.toFixed(3)},
            {label: 'Right',  value: insets.right.toFixed(3)},
            {label: 'Top',    value: insets.top.toFixed(3)},
            {label: 'Bottom', value: insets.bottom.toFixed(3)},
        ];
    }, [tab, srcRect, destRect, quad, insets]);

    return (
        <Stack spacing={1.5}>
            {tab === 'perspective' && (
                <Typography variant="caption" sx={{color: 'text.disabled'}}>
                    CasparCG MIXER PERSPECTIVE accepts arbitrary 4-corner warps —
                    drag any corner anywhere to deform the quad.
                </Typography>
            )}

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 1,
                }}
            >
                {readout.map((r) => (
                    <Stack key={r.label} spacing={0.25}>
                        <Typography variant="caption" sx={{color: 'text.disabled'}}>{r.label}</Typography>
                        <Typography
                            variant="body2"
                            sx={{fontFamily: 'monospace', color: 'text.secondary'}}
                        >
                            {r.value}
                        </Typography>
                    </Stack>
                ))}
            </Box>

            {tab === 'edgeblend' && (
                <Stack
                    spacing={1.5}
                    sx={(theme) => ({
                        p: 2,
                        bgcolor: theme.palette.surface.elevated,
                        borderRadius: 1,
                    })}
                >
                    <Typography variant="caption" sx={{color: 'text.disabled'}}>
                        Drag the dot on each edge to fade that side inward.
                        Gamma / power / alpha shape the blend curve.
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 2,
                        }}
                    >
                        <FloatSlider label="Gamma" value={gamma} min={0.1} max={5} step={0.05} onChange={setGamma} />
                        <FloatSlider label="Power" value={power} min={0.1} max={10} step={0.1}  onChange={setPower} />
                        <FloatSlider label="Alpha" value={alpha} min={0}   max={1}  step={0.01} onChange={setAlpha} />
                    </Box>
                </Stack>
            )}
        </Stack>
    );
};

interface FloatSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
}

const FloatSlider: React.FC<FloatSliderProps> = ({label, value, min, max, step, onChange}) => (
    <Stack spacing={0.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="caption" sx={{color: 'text.secondary'}}>{label}</Typography>
            <TextField
                size="small"
                type="number"
                value={value}
                onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) onChange(n);
                }}
                inputProps={{step, min, max}}
                sx={{width: 100}}
            />
        </Stack>
        <Slider
            size="small"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => onChange(typeof v === 'number' ? v : v[0])}
        />
    </Stack>
);
