import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Card,
    FormControlLabel,
    Modal,
    Stack,
    Switch,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import { useTranslation } from 'next-i18next';
import { useStoredBoolean } from '../../lib/hooks/useStoredBoolean';
import { GeometryStage } from './GeometryStage';
import type { EdgeBlendInsets, NormRect, Perspective } from './GeometryHandles';
import { StageContent } from './geometry/StageContent';
import { TabControls } from './geometry/TabControls';
import {
    rectFromArr,
    arrFromRect,
    quadFromArr,
    arrFromQuad,
    insetsFromArr,
    isIdentityRect,
    isIdentityQuad,
    isZeroInsets,
    GEOMETRY_IDENTITY,
} from './geometry/GeometryUtils';

export interface GeometryValues {
    transform?: number[];
    perspective?: number[];
    edgeblend?: number[];
}

interface GeometryEditorProps {
    open: boolean;
    value: GeometryValues;
    canvasWidth: number;
    canvasHeight: number;
    previewChannel?: number | null;
    onClose: () => void;
    onSave: (value: GeometryValues) => void;
}

const PREVIEW_PREF_KEY = 'geometry-editor-preview';
type Tabkey = 'position' | 'perspective' | 'edgeblend';

export const GeometryEditor: React.FC<GeometryEditorProps> = ({
    open,
    value,
    canvasWidth,
    canvasHeight,
    previewChannel,
    onClose,
    onSave,
}) => {
    const { t } = useTranslation('common');
    const stageRef = useRef<HTMLDivElement | null>(null);
    const [tab, setTab] = useState<Tabkey>('position');
    const [showPreview, setShowPreview] = useStoredBoolean(
        PREVIEW_PREF_KEY,
        false,
    );

    const identityRect = GEOMETRY_IDENTITY.RECT;
    const identityQuad = GEOMETRY_IDENTITY.QUAD;
    const zeroInsets = GEOMETRY_IDENTITY.INSETS;

    const [destRect, setDestRect] = useState<NormRect>({ ...identityRect });
    const [srcRect, setSrcRect] = useState<NormRect>({ ...identityRect });
    const [quad, setQuad] = useState<Perspective>({ ...identityQuad });
    const [insets, setInsets] = useState<EdgeBlendInsets>({ ...zeroInsets });
    const [gamma, setGamma] = useState(1.8);
    const [power, setPower] = useState(3.0);
    const [alpha, setAlpha] = useState(0.5);

    useEffect(() => {
        if (!open) return;
        setSrcRect(rectFromArr(value.transform, 0, identityRect));
        setDestRect(rectFromArr(value.transform, 4, identityRect));
        setQuad(quadFromArr(value.perspective));
        setInsets(insetsFromArr(value.edgeblend));
        const eb = value.edgeblend;
        setGamma(eb?.[4] ?? 1.8);
        setPower(eb?.[5] ?? 3.0);
        setAlpha(eb?.[6] ?? 0.5);
    }, [open, value, identityRect, identityQuad, zeroInsets]);

    const handleSave = () => {
        const next: GeometryValues = {};
        if (!isIdentityRect(srcRect) || !isIdentityRect(destRect))
            next.transform = [
                ...arrFromRect(srcRect),
                ...arrFromRect(destRect),
            ];
        if (!isIdentityQuad(quad)) next.perspective = arrFromQuad(quad);
        if (!isZeroInsets(insets))
            next.edgeblend = [
                insets.left,
                insets.right,
                insets.top,
                insets.bottom,
                gamma,
                power,
                alpha,
            ];
        onSave(next);
        onClose();
    };

    const resetCurrentTab = () => {
        if (tab === 'position') {
            setSrcRect({ ...identityRect });
            setDestRect({ ...identityRect });
        } else if (tab === 'perspective') {
            setQuad({ ...identityQuad });
        } else if (tab === 'edgeblend') {
            setInsets({ ...zeroInsets });
            setGamma(1.8);
            setPower(3.0);
            setAlpha(0.5);
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
                <Card sx={{ p: 3 }}>
                    <Stack spacing={2}>
                        <Stack
                            direction="row"
                            alignItems="baseline"
                            justifyContent="space-between"
                            gap={2}
                        >
                            <Stack spacing={0.5}>
                                <Typography variant="h3">
                                    {t('videoRoutes.geometry.title')}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ color: 'text.secondary' }}
                                >
                                    {t('videoRoutes.geometry.description')}
                                </Typography>
                            </Stack>
                            <Stack direction="row" alignItems="center" gap={2}>
                                {previewChannel != null && (
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                size="small"
                                                checked={showPreview}
                                                onChange={e =>
                                                    setShowPreview(
                                                        e.target.checked,
                                                    )
                                                }
                                            />
                                        }
                                        label={
                                            <Typography variant="caption">
                                                {t(
                                                    'videoRoutes.geometry.livePreview',
                                                    {
                                                        channel: previewChannel,
                                                    },
                                                )}
                                            </Typography>
                                        }
                                        labelPlacement="start"
                                        sx={{
                                            m: 0,
                                            '& .MuiFormControlLabel-label': {
                                                color: 'text.secondary',
                                            },
                                        }}
                                    />
                                )}
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.disabled',
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {canvasWidth}×{canvasHeight}
                                </Typography>
                            </Stack>
                        </Stack>

                        <Tabs
                            value={tab}
                            onChange={(_, v) => setTab(v as Tabkey)}
                        >
                            <Tab
                                value="position"
                                label={t('videoRoutes.geometry.tabs.position')}
                            />
                            <Tab
                                value="perspective"
                                label={t(
                                    'videoRoutes.geometry.tabs.perspective',
                                )}
                            />
                            <Tab
                                value="edgeblend"
                                label={t('videoRoutes.geometry.tabs.edgeblend')}
                            />
                        </Tabs>

                        <Box ref={stageRef} sx={{ position: 'relative' }}>
                            <GeometryStage
                                canvasWidth={canvasWidth}
                                canvasHeight={canvasHeight}
                                previewChannel={
                                    showPreview ? previewChannel : null
                                }
                            >
                                {({ width, height }) => (
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

                        <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                        >
                            <Button color="inherit" onClick={resetCurrentTab}>
                                {t('videoRoutes.geometry.resetTab')}
                            </Button>
                            <Stack direction="row" gap={1}>
                                <Button onClick={onClose} color="inherit">
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    variant="contained"
                                >
                                    {t('actions.save')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            </Box>
        </Modal>
    );
};
