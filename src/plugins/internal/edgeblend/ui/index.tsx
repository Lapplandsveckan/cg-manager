import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Stack,
    Switch,
    Tooltip,
    Typography,
} from '@mui/material';
import { useSocket } from '@web-lib';
import { useTranslation } from 'react-i18next';
import LayoutEditor, {
    type StoredLayout,
    type LayoutForm,
    DEFAULT_FORM,
    toForm,
    fromForm,
} from './LayoutEditor';
import LayoutDiagram from './LayoutDiagram';

const PLUGIN = 'edgeblend';
const API_ROOT = `/api/plugin/${PLUGIN}`;
const BROADCAST_PATH = `plugin/${PLUGIN}/layouts`;

const EdgeblendPage: React.FC = () => {
    const conn = useSocket();
    const { t } = useTranslation();

    const [layouts, setLayouts] = useState<StoredLayout[] | null>(null);
    const [channels, setChannels] = useState<number[]>([]);
    const [selected, setSelected] = useState<string | 'new' | null>(null);
    const [form, setForm] = useState<LayoutForm>(DEFAULT_FORM);
    const [editEnabled, setEditEnabled] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [focusedOutput, setFocusedOutput] = useState<number | null>(null);

    useEffect(() => {
        if (!conn) return;
        conn.caspar
            .getConfig()
            .then(cfg =>
                setChannels(cfg.channels.map((_: unknown, i: number) => i + 1)),
            )
            .catch(() => {
                /* caspar not connected */
            });
    }, [conn]);

    useEffect(() => {
        if (!conn) return;
        let mounted = true;

        conn.rawRequest(`${API_ROOT}/layouts`, 'GET', {})
            .then((res: unknown) => {
                if (mounted)
                    setLayouts((res as { data: StoredLayout[] }).data ?? []);
            })
            .catch(() => mounted && setLayouts([]));

        const listener = {
            path: BROADCAST_PATH,
            method: 'UPDATE',
            handler: (req: unknown) => {
                const data = (
                    req as { getData: () => StoredLayout[] }
                ).getData();
                if (Array.isArray(data)) setLayouts(data);
            },
        };
        conn.routes.register(listener);
        return () => {
            mounted = false;
            conn.routes.unregister(listener);
        };
    }, [conn]);

    const selectLayout = useCallback((layout: StoredLayout) => {
        setSelected(layout.id);
        setForm(toForm(layout));
        setEditEnabled(layout.enabled);
        setFocusedOutput(null);
    }, []);

    const startNew = useCallback(() => {
        setSelected('new');
        setForm(DEFAULT_FORM);
        setEditEnabled(false);
        setFocusedOutput(null);
    }, []);

    const gridCount = form.cols * form.rows;

    const setGrid = useCallback((cols: number, rows: number) => {
        const count = cols * rows;
        setForm(prev => {
            const outs = [...prev.outputChannels];
            while (outs.length < count)
                outs.push(outs[outs.length - 1] + 1 || 2);
            return {
                ...prev,
                cols,
                rows,
                outputChannels: outs.slice(0, count),
            };
        });
    }, []);

    const setOutput = useCallback((idx: number, ch: number) => {
        setForm(prev => {
            const outs = [...prev.outputChannels];
            outs[idx] = ch;
            return { ...prev, outputChannels: outs };
        });
    }, []);

    const isValid =
        form.name.trim().length > 0 &&
        form.canvasW > 0 &&
        form.canvasH > 0 &&
        form.projectorW > 0 &&
        form.projectorH > 0 &&
        form.cols >= 1 &&
        form.rows >= 1 &&
        form.outputChannels.length === gridCount;

    const save = async () => {
        if (!conn || !isValid) return;
        setSaving(true);
        const body = fromForm(form, editEnabled);
        if (selected === 'new') {
            await conn
                .rawRequest(`${API_ROOT}/layouts`, 'ACTION', body)
                .catch(() => null);
            setSelected(null);
        } else if (selected) {
            await conn
                .rawRequest(`${API_ROOT}/layouts/${selected}`, 'UPDATE', body)
                .catch(() => null);
        }
        setSaving(false);
    };

    const remove = async () => {
        if (!conn || !selected || selected === 'new') return;
        await conn
            .rawRequest(`${API_ROOT}/layouts/${selected}`, 'DELETE', null)
            .catch(() => null);
        setSelected(null);
    };

    const toggleEnabled = async (layout: StoredLayout) => {
        if (!conn) return;
        await conn
            .rawRequest(`${API_ROOT}/layouts/${layout.id}`, 'UPDATE', {
                enabled: !layout.enabled,
            })
            .catch(() => null);
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', gap: 2, p: 2 }}>
            {/* Left — layout list */}
            <Box sx={{ width: 280, flexShrink: 0 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    mb={1}
                >
                    <Typography variant="h3">
                        {t('plugins.edgeblend.layouts')}
                    </Typography>
                    <Button size="small" variant="outlined" onClick={startNew}>
                        {t('plugins.edgeblend.addLayout')}
                    </Button>
                </Stack>

                <List dense disablePadding>
                    {layouts === null && (
                        <ListItem>
                            <ListItemText secondary={t('actions.loading')} />
                        </ListItem>
                    )}
                    {layouts?.length === 0 && (
                        <ListItem>
                            <ListItemText
                                secondary={t('plugins.edgeblend.noLayouts')}
                            />
                        </ListItem>
                    )}
                    {(layouts ?? []).map(layout => (
                        <ListItem
                            key={layout.id}
                            disablePadding
                            secondaryAction={
                                <Tooltip
                                    title={
                                        layout.enabled
                                            ? t('plugins.edgeblend.disable')
                                            : t('plugins.edgeblend.enable')
                                    }
                                >
                                    <Switch
                                        size="small"
                                        checked={layout.enabled}
                                        onChange={() => toggleEnabled(layout)}
                                    />
                                </Tooltip>
                            }
                        >
                            <ListItemButton
                                selected={selected === layout.id}
                                onClick={() => selectLayout(layout)}
                            >
                                <ListItemText
                                    primary={layout.name}
                                    secondary={`${layout.size[0]}×${layout.size[1]}`}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            </Box>

            <Divider orientation="vertical" flexItem />

            {/* Right — edit form + diagram */}
            {selected ? (
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        gap: 2,
                        overflow: 'hidden',
                    }}
                >
                    <Box sx={{ flexShrink: 0, width: 380, overflowY: 'auto' }}>
                        <LayoutEditor
                            selected={selected}
                            form={form}
                            setForm={setForm}
                            editEnabled={editEnabled}
                            setEditEnabled={setEditEnabled}
                            channels={channels}
                            gridCount={gridCount}
                            isValid={isValid}
                            saving={saving}
                            setGrid={setGrid}
                            setOutput={setOutput}
                            onSave={save}
                            onClose={() => setSelected(null)}
                            onDelete={remove}
                            focusedOutput={focusedOutput}
                        />
                    </Box>

                    <Divider orientation="vertical" flexItem />

                    <LayoutDiagram
                        canvasW={form.canvasW}
                        canvasH={form.canvasH}
                        projectorW={form.projectorW}
                        projectorH={form.projectorH}
                        cols={form.cols}
                        rows={form.rows}
                        outputChannels={form.outputChannels}
                        showPreview={showPreview}
                        onTogglePreview={() => setShowPreview(p => !p)}
                        previewChannel={form.inputChannel}
                        focusedOutput={focusedOutput}
                        onFocusOutput={setFocusedOutput}
                    />
                </Box>
            ) : (
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography color="text.secondary">
                        {t('plugins.edgeblend.selectOrAdd')}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default EdgeblendPage;
