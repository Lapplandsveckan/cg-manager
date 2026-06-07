import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Box, IconButton, Stack, Tab, Tabs, Tooltip, Typography} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {useTranslation} from 'next-i18next';
import {useSocket} from '../lib/hooks/useSocket';
import {useStoredBoolean} from '../lib/hooks/useStoredBoolean';
import {useStoredNumber} from '../lib/hooks/useStoredNumber';
import {type Injection, Injections, UI_INJECTION_ZONE} from '../lib/api/inject';

const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 600;
const HEIGHT_KEY = 'rundown-bottom-panel-height';
const COLLAPSED_KEY = 'rundown-bottom-panel-collapsed';

function clampHeight(h: number): number {
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(h)));
}

interface ResizeProps {
    onResize: (next: number) => void;
    getCurrentHeight: () => number;
}

const VerticalResizeHandle: React.FC<ResizeProps> = ({ onResize, getCurrentHeight }) => {
    const {t} = useTranslation('common');
    const dragRef = useRef<{ y: number; h: number } | null>(null);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        dragRef.current = { y: e.clientY, h: getCurrentHeight() };
        document.body.style.cursor = 'row-resize';
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        // The panel is anchored to the bottom: dragging up = bigger panel.
        const dy = e.clientY - dragRef.current.y;
        const proposed = dragRef.current.h - dy;
        const clamped = clampHeight(proposed);
        if (clamped !== proposed) {
            dragRef.current.y = e.clientY;
            dragRef.current.h = clamped;
        }
        onResize(clamped);
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragRef.current) return;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        dragRef.current = null;
        document.body.style.cursor = '';
    };

    return (
        <Tooltip title={t('rundown.bottomPanel.resizeHint')} placement="top">
            <Box
                role="separator"
                aria-orientation="horizontal"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => onResize(DEFAULT_HEIGHT)}
                sx={(theme) => ({
                    position: 'relative',
                    height: 10,
                    cursor: 'row-resize',
                    touchAction: 'none',
                    flexShrink: 0,
                    '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: '50%',
                        height: '1px',
                        bgcolor: theme.palette.divider,
                        transform: 'translateY(-50%)',
                        transition: theme.transitions.create(['background-color', 'height'], { duration: 120 }),
                    },
                    '&:hover::after, &:active::after': {
                        bgcolor: theme.palette.primary.main,
                        height: '2px',
                    },
                })}
            />
        </Tooltip>
    );
};


export const BottomPanel: React.FC = () => {
    const {t} = useTranslation('common');
    const socket = useSocket();
    const [injections, setInjections] = useState<Injection[] | null>(null);

    const [height, setHeight] = useStoredNumber(HEIGHT_KEY, DEFAULT_HEIGHT, clampHeight);
    const [collapsed, setCollapsed] = useStoredBoolean(COLLAPSED_KEY, false);

    const [activePlugin, setActivePlugin] = useState<string | null>(null);

    useEffect(() => {
        if (!socket) return;
        let mounted = true;
        socket.injects.getInjects(UI_INJECTION_ZONE.RUNDOWN_BOTTOM_PANEL)
            .then((list) => { if (mounted) setInjections(list); })
            .catch(() => { if (mounted) setInjections([]); });
        return () => { mounted = false; };
    }, [socket]);

    // Group injections by plugin so each plugin contributes one tab. A plugin
    // with several injections gets them stacked inside its tab.
    const pluginNames = useMemo(() => {
        if (!injections) return [];
        const seen = new Set<string>();
        const ordered: string[] = [];
        for (const inj of injections)
            if (!seen.has(inj.plugin)) {
                seen.add(inj.plugin);
                ordered.push(inj.plugin);
            }

        return ordered;
    }, [injections]);

    useEffect(() => {
        if (pluginNames.length === 0) {
            if (activePlugin !== null) setActivePlugin(null);
            return;
        }
        if (!activePlugin || !pluginNames.includes(activePlugin))
            setActivePlugin(pluginNames[0]);
    }, [pluginNames, activePlugin]);

    // While injections are still loading, render nothing. Once we know there
    // are zero contributions, also render nothing — no plugins = no panel.
    if (!injections || injections.length === 0) return null;

    return (
        <Stack
            sx={(theme) => ({
                // Match the page background so the surrounding layout padding
                // doesn't create a visible "frame" around the panel. The top
                // divider still gives a clean break from the columns above.
                bgcolor: theme.palette.background.default,
                // When the panel is open the resize handle's hairline already
                // serves as the top edge; only draw our own divider when the
                // handle is hidden (collapsed state).
                borderTop: collapsed ? `1px solid ${theme.palette.divider}` : 'none',
                flexShrink: 0,
                // Pull the panel out into the page padding so it can sit flush
                // against the layout's edges horizontally and at the bottom.
                // The inner sections handle their own modest insets so we
                // don't end up with double-padding.
                mx: -4,
                mb: -4,
            })}
        >
            {!collapsed && (
                <VerticalResizeHandle
                    onResize={setHeight}
                    getCurrentHeight={() => height}
                />
            )}

            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                onClick={() => setCollapsed(v => !v)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCollapsed(v => !v);
                    }
                }}
                role="button"
                tabIndex={0}
                aria-expanded={!collapsed}
                aria-label={collapsed
                    ? t('rundown.bottomPanel.expandAria')
                    : t('rundown.bottomPanel.collapseAria')}
                sx={(theme) => ({
                    px: 2,
                    borderBottom: collapsed ? 'none' : `1px solid ${theme.palette.divider}`,
                    minHeight: 40,
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: -2,
                    },
                })}
            >
                {pluginNames.length > 1 ? (
                    // Tabs swallow their own clicks so switching tabs doesn't
                    // toggle the panel. The Tabs container fills the bar's
                    // available width naturally; click-through on empty bar
                    // gutters still bubbles to the Stack handler.
                    <Tabs
                        value={activePlugin ?? false}
                        onChange={(_, v) => setActivePlugin(v)}
                        onClick={(e) => e.stopPropagation()}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ minHeight: 36 }}
                    >
                        {pluginNames.map(name => (
                            <Tab
                                key={name}
                                value={name}
                                label={name}
                                sx={{
                                    minHeight: 36,
                                    textTransform: 'none',
                                    fontSize: '0.8125rem',
                                }}
                            />
                        ))}
                    </Tabs>
                ) : (
                    <Typography variant="h6" sx={{ pl: 1 }}>
                        {pluginNames[0] ?? ''}
                    </Typography>
                )}

                <Tooltip title={collapsed
                    ? t('rundown.bottomPanel.expand')
                    : t('rundown.bottomPanel.collapse')}>
                    <IconButton
                        size="small"
                        // The icon button delegates to the same toggle as the
                        // bar; stopPropagation prevents double-toggling.
                        onClick={(e) => {
                            e.stopPropagation();
                            setCollapsed(v => !v);
                        }}
                        sx={{ color: 'text.secondary', mr: 0.5 }}
                    >
                        {collapsed
                            ? <ExpandLessRoundedIcon fontSize="small" />
                            : <ExpandMoreRoundedIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>
            </Stack>

            {!collapsed && activePlugin && (
                <Box
                    sx={{
                        height,
                        overflow: 'auto',
                        px: 2,
                        py: 1.5,
                    }}
                >
                    <Injections
                        zone={UI_INJECTION_ZONE.RUNDOWN_BOTTOM_PANEL}
                        plugin={activePlugin}
                    />
                </Box>
            )}
        </Stack>
    );
};
