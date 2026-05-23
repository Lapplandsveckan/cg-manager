import React, {useEffect, useMemo, useState} from 'react';
import {
    Box, Card, Chip, LinearProgress, List, ListItem, ListItemText,
    Stack, Typography,
} from '@mui/material';
import {useSocket} from '@web-lib';

// Mirrored from the server-side `EncodeStateSnapshot`. Kept locally so
// the UI bundle doesn't need to import out of the plugin's own folder
// (webpack `externals` doesn't make sibling files visible).
interface EncodeStateSnapshot {
    active: {
        path: string;
        startedAt: number;
        progressMs: number;
        durationMs?: number;
    } | null;
    pending: { path: string }[];
    recent: {
        path: string;
        success: boolean;
        durationMs: number;
        completedAt: number;
        error?: string;
    }[];
}

const EMPTY: EncodeStateSnapshot = { active: null, pending: [], recent: [] };

/** Take a filesystem path and return just the basename for compact
 *  display. Full paths are kept as the tooltip via `title=`. */
function basename(p: string): string {
    const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
    return i >= 0 ? p.slice(i + 1) : p;
}

function formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) return '–';
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** A clock that re-renders every second so "elapsed" stays current
 *  even when the server isn't sending fresh progress messages. */
function useTicker(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(t);
    }, [intervalMs]);
    return now;
}

const ActiveCard: React.FC<{ active: EncodeStateSnapshot['active'] }> = ({active}) => {
    const now = useTicker(1000);
    if (!active) return null;

    const elapsedMs = Math.max(0, now - active.startedAt);
    // Show a real percent if we know the source duration, fall back to
    // an indeterminate bar otherwise — better than misleading numbers.
    const percent = active.durationMs
        ? Math.min(100, (active.progressMs / active.durationMs) * 100)
        : null;

    return (
        <Card sx={{p: 2.5}}>
            <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                    <Stack spacing={0.25} sx={{minWidth: 0}}>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>
                            Encoding
                        </Typography>
                        <Typography
                            variant="h5"
                            title={active.path}
                            sx={{wordBreak: 'break-word'}}
                        >
                            {basename(active.path)}
                        </Typography>
                    </Stack>
                    <Stack alignItems="flex-end" spacing={0.25}>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>Elapsed</Typography>
                        <Typography variant="body1" sx={{fontVariantNumeric: 'tabular-nums'}}>
                            {formatDuration(elapsedMs)}
                        </Typography>
                    </Stack>
                </Stack>

                <Box>
                    <LinearProgress
                        variant={percent === null ? 'indeterminate' : 'determinate'}
                        value={percent ?? undefined}
                        sx={{height: 6, borderRadius: 999}}
                    />
                    <Stack direction="row" justifyContent="space-between" sx={{mt: 0.75}}>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>
                            {formatDuration(active.progressMs)}
                            {active.durationMs ? ` / ${formatDuration(active.durationMs)}` : ''}
                        </Typography>
                        {percent !== null && (
                            <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                {percent.toFixed(0)}%
                            </Typography>
                        )}
                    </Stack>
                </Box>
            </Stack>
        </Card>
    );
};

const PendingList: React.FC<{ pending: EncodeStateSnapshot['pending'] }> = ({pending}) => (
    <Card sx={{p: 2.5}}>
        <Stack direction="row" alignItems="center" gap={1} sx={{mb: 1}}>
            <Typography variant="h5">Queue</Typography>
            <Chip
                size="small"
                label={pending.length}
                sx={{height: 20, fontSize: '0.7rem'}}
            />
        </Stack>
        {pending.length === 0 ? (
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                Nothing waiting.
            </Typography>
        ) : (
            <List dense disablePadding>
                {pending.map((p) => (
                    <ListItem key={p.path} disableGutters disablePadding>
                        <ListItemText
                            primary={basename(p.path)}
                            secondary={p.path}
                            primaryTypographyProps={{variant: 'body2'}}
                            secondaryTypographyProps={{
                                variant: 'caption',
                                sx: {color: 'text.disabled', wordBreak: 'break-all'},
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        )}
    </Card>
);

const RecentList: React.FC<{ recent: EncodeStateSnapshot['recent'] }> = ({recent}) => (
    <Card sx={{p: 2.5}}>
        <Stack direction="row" alignItems="center" gap={1} sx={{mb: 1}}>
            <Typography variant="h5">Recently encoded</Typography>
            <Chip
                size="small"
                label={recent.length}
                sx={{height: 20, fontSize: '0.7rem'}}
            />
        </Stack>
        {recent.length === 0 ? (
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                Nothing yet — finished encodes will appear here.
            </Typography>
        ) : (
            <List dense disablePadding>
                {recent.map((r) => (
                    <ListItem key={`${r.path}-${r.completedAt}`} disableGutters disablePadding>
                        <ListItemText
                            primary={
                                <Stack direction="row" alignItems="center" gap={1}>
                                    <Chip
                                        size="small"
                                        label={r.success ? 'OK' : 'Failed'}
                                        color={r.success ? 'success' : 'error'}
                                        variant="outlined"
                                        sx={{height: 20, fontSize: '0.65rem'}}
                                    />
                                    <Typography variant="body2">{basename(r.path)}</Typography>
                                    <Typography variant="caption" sx={{color: 'text.secondary'}}>
                                        · {formatDuration(r.durationMs)}
                                    </Typography>
                                </Stack>
                            }
                            secondary={r.error ?? r.path}
                            secondaryTypographyProps={{
                                variant: 'caption',
                                sx: {
                                    color: r.error ? 'error.main' : 'text.disabled',
                                    wordBreak: 'break-all',
                                },
                            }}
                        />
                    </ListItem>
                ))}
            </List>
        )}
    </Card>
);

const EncodePage: React.FC = () => {
    const socket = useSocket();
    const [snap, setSnap] = useState<EncodeStateSnapshot>(EMPTY);

    useEffect(() => {
        if (!socket) return;
        let cancelled = false;

        // Plugin routes + broadcasts are namespaced under
        // `plugin/<pluginName>/...` by PluginAPI, so the full path is
        // `/api/plugin/encode/state` on HTTP and `plugin/encode/state`
        // on the WS action topic.
        socket.rawRequest('/api/plugin/encode/state', 'GET', {})
            .then((res: any) => {
                if (cancelled) return;
                setSnap((res?.data as EncodeStateSnapshot) ?? EMPTY);
            })
            .catch(() => undefined);

        const listener = {
            path: 'plugin/encode/state',
            method: 'ACTION',
            handler: (request: any) => {
                const data = request.data ?? request.getData?.();
                if (data) setSnap(data as EncodeStateSnapshot);
            },
        };
        socket.routes.register(listener);

        return () => {
            cancelled = true;
            socket.routes.unregister(listener);
        };
    }, [socket]);

    const totalQueued = useMemo(
        () => (snap.active ? 1 : 0) + snap.pending.length,
        [snap],
    );

    return (
        <Stack spacing={2} sx={{maxWidth: 720}}>
            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                Prepares uploaded media for playback.
                {totalQueued > 0 && ` ${totalQueued} item${totalQueued === 1 ? '' : 's'} in flight.`}
            </Typography>

            {snap.active && <ActiveCard active={snap.active} />}
            <PendingList pending={snap.pending} />
            <RecentList recent={snap.recent} />
        </Stack>
    );
};

export default EncodePage;
