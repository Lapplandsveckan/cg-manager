import {useEffect, useRef, useState} from 'react';
import {Box, Button, Card, IconButton, Stack, Tooltip, Typography, alpha} from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import VerticalAlignBottomRoundedIcon from '@mui/icons-material/VerticalAlignBottomRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {useSocket} from '../lib/hooks/useSocket';
import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {CasparStatus} from '../lib/api/caspar';
import {PreviewPanel} from '../components/PreviewPanel';

type Tone = 'success' | 'error' | 'warning' | 'neutral';

function statusTone(status: CasparStatus | null): { tone: Tone; label: string; detail: string } {
    if (!status) return { tone: 'neutral', label: 'Unknown', detail: 'Waiting for the server to report state…' };
    if (!status.supported) return { tone: 'warning', label: 'Unsupported platform', detail: status.lastError ?? 'CasparCG can\'t be started on this platform.' };
    if (status.running) return { tone: 'success', label: 'Running', detail: 'CasparCG is up and accepting commands.' };
    if (status.lastError) return { tone: 'error', label: 'Stopped (error)', detail: status.lastError };
    return { tone: 'neutral', label: 'Stopped', detail: 'CasparCG is not running.' };
}

function toneColor(tone: Tone): string {
    switch (tone) {
        case 'success': return '#5fc97a';
        case 'error':   return '#cf5b4a';
        case 'warning': return '#e0b04c';
        case 'neutral': return 'rgba(232, 234, 237, 0.45)';
    }
}

const StatusCard: React.FC<{ status: CasparStatus | null }> = ({ status }) => {
    const { tone, label, detail } = statusTone(status);
    const color = toneColor(tone);

    return (
        <Card sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" gap={2}>
                <Box
                    sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        bgcolor: color,
                        boxShadow: tone === 'success' ? `0 0 8px ${color}` : 'none',
                        flexShrink: 0,
                    }}
                />
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography variant="h3">{label}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-word' }}>
                        {detail}
                    </Typography>
                </Stack>
            </Stack>
        </Card>
    );
};

interface ControlsProps {
    status: CasparStatus | null;
    busy: string | null;
    onStart: () => void;
    onStop: () => void;
    onRestart: () => void;
}

const Controls: React.FC<ControlsProps> = ({ status, busy, onStart, onStop, onRestart }) => {
    const supported = status?.supported ?? true;
    const running = status?.running ?? false;

    return (
        <Stack direction="row" gap={1}>
            <Button
                variant="contained"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={onStart}
                disabled={!supported || running || busy !== null}
            >
                {busy === 'start' ? 'Starting…' : 'Start'}
            </Button>
            <Button
                variant="outlined"
                color="inherit"
                startIcon={<StopRoundedIcon />}
                onClick={onStop}
                disabled={!running || busy !== null}
            >
                {busy === 'stop' ? 'Stopping…' : 'Stop'}
            </Button>
            <Button
                variant="outlined"
                color="inherit"
                startIcon={<RestartAltRoundedIcon />}
                onClick={onRestart}
                disabled={!supported || busy !== null}
            >
                {busy === 'restart' ? 'Restarting…' : 'Restart'}
            </Button>
        </Stack>
    );
};

const UnsupportedBanner: React.FC<{ message: string }> = ({ message }) => (
    <Card
        sx={(theme) => ({
            p: 2.5,
            borderColor: alpha('#e0b04c', 0.4),
            bgcolor: alpha('#e0b04c', 0.06),
        })}
    >
        <Stack direction="row" gap={1.5} alignItems="flex-start">
            <WarningAmberRoundedIcon sx={{ color: '#e0b04c', mt: 0.25 }} />
            <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography variant="h4" sx={{ color: '#e0b04c' }}>
                    CasparCG can&apos;t run on this platform
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {message} Run the manager on a supported host (Linux or Windows) to use the
                    server controls. The rest of the UI still works for browsing and editing.
                </Typography>
            </Stack>
        </Stack>
    </Card>
);

interface LogViewerProps {
    logs: string;
    onClear: () => void;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [follow, setFollow] = useState(true);

    useEffect(() => {
        if (!follow) return;
        const el = containerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [logs, follow]);

    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        setFollow(atBottom);
    };

    const scrollToBottom = () => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        setFollow(true);
    };

    return (
        <Card sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, flexGrow: 1 }}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={(theme) => ({
                    px: 2,
                    py: 1,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Typography variant="h6">Logs</Typography>
                <Stack direction="row" gap={0.5}>
                    {!follow && (
                        <Tooltip title="Scroll to bottom">
                            <IconButton size="small" onClick={scrollToBottom}>
                                <VerticalAlignBottomRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Clear log view (server keeps the original)">
                        <span>
                            <IconButton size="small" onClick={onClear} disabled={!logs}>
                                <DeleteSweepRoundedIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>
            <Box
                ref={containerRef}
                onScroll={handleScroll}
                sx={(theme) => ({
                    flexGrow: 1,
                    minHeight: 320,
                    maxHeight: '60vh',
                    overflow: 'auto',
                    px: 2,
                    py: 1.5,
                    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    color: theme.palette.text.secondary,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    bgcolor: theme.palette.surface.base,
                })}
            >
                {logs || (
                    <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                        No log output yet.
                    </Typography>
                )}
            </Box>
        </Card>
    );
};

const Page = () => {
    const socket = useSocket();
    const [status, setStatus] = useState<CasparStatus | null>(null);
    const [logs, setLogs] = useState<string>('');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!socket) return;

        const statusListener = (s: CasparStatus) => setStatus(s);
        const logListener = (l: string) => setLogs(l);

        socket.caspar.on('status', statusListener);
        socket.caspar.on('logs', logListener);

        socket.caspar.getStatus().then(statusListener).catch(() => setStatus(null));
        socket.caspar.getLogs().then(logListener).catch(() => setLogs(''));

        return () => {
            socket.caspar.off('status', statusListener);
            socket.caspar.off('logs', logListener);
        };
    }, [socket]);

    const runAction = async (action: 'start' | 'stop' | 'restart') => {
        if (!socket) return;
        setBusy(action);
        setError(null);
        try {
            await socket.caspar[action]();
        } catch (e) {
            setError((e as Error)?.message ?? `Failed to ${action}`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <DefaultContentLayout>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} mb={3}>
                <Stack spacing={1}>
                    <Typography variant="h1">Server</Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                        Start, stop, and monitor the CasparCG process this manager wraps.
                    </Typography>
                </Stack>
                <Controls
                    status={status}
                    busy={busy}
                    onStart={() => runAction('start')}
                    onStop={() => runAction('stop')}
                    onRestart={() => runAction('restart')}
                />
            </Stack>

            <Stack spacing={2} sx={{ minHeight: 0, display: 'flex', flexGrow: 1 }}>
                <StatusCard status={status} />

                {status && !status.supported && (
                    <UnsupportedBanner message={status.lastError ?? ''} />
                )}

                {error && (
                    <Card sx={(theme) => ({ p: 2, borderColor: theme.palette.error.main })}>
                        <Typography variant="body1" color="error">{error}</Typography>
                    </Card>
                )}

                <PreviewPanel />

                <LogViewer logs={logs} onClear={() => setLogs('')} />
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;
