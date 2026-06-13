import {
    Box,
    Button,
    Card,
    Chip,
    Modal,
    Stack,
    Switch,
    Typography,
    alpha,
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import { useSocket } from '../../lib/hooks/useSocket';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { type Plugin } from '../../lib/api/plugin';
import { UI_INJECTION_ZONE } from '../../lib/api/inject';
import {
    Dropzone,
    UploadButton,
    UploadModal,
    useFileUpload,
} from '../../components/Upload';

interface PluginCardProps {
    plugin: Plugin;
    hasUi: boolean;
    channelCount: number;
    onToggle: (next: boolean) => void;
    onOpen: () => void;
    onUninstall: () => void;
}

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const { t } = useTranslation('common');
    const color = enabled ? '#5fc97a' : 'rgba(232, 234, 237, 0.4)';
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={theme => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: enabled
                    ? alpha('#5fc97a', 0.1)
                    : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: color,
                }}
            />
            <Typography
                variant="caption"
                sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}
            >
                {enabled
                    ? t('pluginsPage.status.active')
                    : t('pluginsPage.status.disabled')}
            </Typography>
        </Stack>
    );
};

const PluginCard: React.FC<PluginCardProps> = ({
    plugin,
    hasUi,
    channelCount,
    onToggle,
    onOpen,
    onUninstall,
}) => {
    const { t } = useTranslation('common');
    const insufficient = plugin.minChannels > 0 && channelCount < plugin.minChannels;
    return (
        <Card
            onClick={onOpen}
            sx={theme => ({
                p: 2.5,
                cursor: 'pointer',
                transition: theme.transitions.create(
                    ['border-color', 'background-color'],
                    { duration: 120 },
                ),
                '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.45),
                    bgcolor: theme.palette.surface.elevated,
                },
            })}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
            >
                <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1.25}>
                        <Typography
                            variant="h4"
                            sx={{ wordBreak: 'break-word' }}
                        >
                            {plugin.name}
                        </Typography>
                        <StatusPill enabled={plugin.enabled} />
                        {insufficient && (
                            <Chip
                                size="small"
                                icon={<WarningAmberRoundedIcon sx={{ fontSize: '0.9rem !important' }} />}
                                label={t('pluginsPage.channels.insufficient', {
                                    need: plugin.minChannels,
                                    have: channelCount,
                                })}
                                sx={theme => ({
                                    bgcolor: alpha(theme.palette.warning.main, 0.1),
                                    color: theme.palette.warning.main,
                                    border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
                                    '& .MuiChip-icon': { color: 'inherit' },
                                })}
                            />
                        )}
                    </Stack>
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {hasUi
                            ? t('pluginsPage.card.openForConfig')
                            : t('pluginsPage.card.noUi')}
                    </Typography>
                </Stack>

                <Stack
                    direction="row"
                    alignItems="center"
                    gap={0.5}
                    sx={{ flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    <Switch
                        color="primary"
                        checked={plugin.enabled}
                        onChange={(_, checked) => onToggle(checked)}
                        inputProps={{
                            'aria-label': t('pluginsPage.togglePlugin', {
                                name: plugin.name,
                            }),
                        }}
                    />
                    {!plugin.builtin && (
                        <Button
                            size="small"
                            color="error"
                            sx={{ minWidth: 0, px: 0.75, py: 0.5 }}
                            title={t('pluginsPage.uninstall.button')}
                            onClick={e => {
                                e.stopPropagation();
                                onUninstall();
                            }}
                        >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </Button>
                    )}
                    <ChevronRightIcon
                        fontSize="small"
                        sx={{ color: 'text.disabled', pointerEvents: 'none' }}
                    />
                </Stack>
            </Stack>
        </Card>
    );
};

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();

    const [plugins, setPlugins] = useState<Plugin[] | null>(null);
    const [pluginsWithUi, setPluginsWithUi] = useState<Set<string>>(new Set());
    const [channelCount, setChannelCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [enableWarning, setEnableWarning] = useState<{ name: string; need: number; have: number } | null>(null);
    const [channelPrompt, setChannelPrompt] = useState<{ name: string; need: number; have: number } | null>(null);
    const [showRestartPrompt, setShowRestartPrompt] = useState(false);
    const [addingChannels, setAddingChannels] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const prevPluginNamesRef = useRef<Set<string>>(new Set());

    const uploadCtrl = useFileUpload({
        createUpload: file => socket.plugin.uploadPlugin(file),
    });

    useEffect(() => {
        if (!socket) return;
        let mounted = true;

        Promise.all([
            socket.plugin.getPlugins(),
            socket.injects.getInjects(UI_INJECTION_ZONE.PLUGIN_PAGE),
            socket.caspar.getConfig(),
        ])
            .then(([list, injects, cfg]) => {
                if (!mounted) return;
                setPlugins(list);
                setPluginsWithUi(new Set(injects.map(i => i.plugin)));
                setChannelCount(cfg.channels.length);
                prevPluginNamesRef.current = new Set(list.map(p => p.name));
            })
            .catch(
                e =>
                    mounted &&
                    setError(e?.message ?? t('pluginsPage.loadError')),
            );

        // Live updates pushed from the server after install / uninstall /
        // enable / disable. Re-resolve the UI-injection set too so a freshly
        // installed plugin gets its config affordance without a reload.
        const onPluginChange = (list: Plugin[]) => {
            if (!mounted) return;
            // Detect newly installed plugins that need more channels than available.
            socket.caspar
                .getConfig()
                .then(cfg => {
                    if (!mounted) return;
                    const currentCount = cfg.channels.length;
                    setChannelCount(currentCount);
                    const prev = prevPluginNamesRef.current;
                    for (const p of list) {
                        if (!prev.has(p.name) && p.minChannels > 0 && p.minChannels > currentCount) {
                            setChannelPrompt({ name: p.name, need: p.minChannels, have: currentCount });
                            break;
                        }
                    }
                    prevPluginNamesRef.current = new Set(list.map(p => p.name));
                })
                .catch(() => {});
            setPlugins(list);
            socket.injects
                .getInjects(UI_INJECTION_ZONE.PLUGIN_PAGE)
                .then(injects => {
                    if (mounted)
                        setPluginsWithUi(new Set(injects.map(i => i.plugin)));
                })
                .catch(() => {});
        };
        socket.plugin.on('change', onPluginChange);

        return () => {
            mounted = false;
            socket.plugin.off('change', onPluginChange);
        };
    }, [socket]);

    const applyToggle = useCallback(
        async (name: string, next: boolean) => {
            if (!socket) return;
            setPlugins(
                prev =>
                    prev?.map(p =>
                        p.name === name ? { ...p, enabled: next } : p,
                    ) ?? prev,
            );
            const [err, confirmed] = await noTryAsync(async () =>
                socket.plugin.setEnabled(name, next),
            );
            if (err) {
                setPlugins(
                    prev =>
                        prev?.map(p =>
                            p.name === name ? { ...p, enabled: !next } : p,
                        ) ?? prev,
                );
                console.error(`Failed to toggle plugin "${name}"`, err);
                return;
            }
            const settled = typeof confirmed === 'boolean' ? confirmed : next;
            setPlugins(
                prev =>
                    prev?.map(p =>
                        p.name === name ? { ...p, enabled: settled } : p,
                    ) ?? prev,
            );
        },
        [socket],
    );

    const togglePlugin = useCallback(
        (name: string, next: boolean) => {
            if (!next) { applyToggle(name, next); return; }
            const plugin = plugins?.find(p => p.name === name);
            if (plugin && plugin.minChannels > channelCount) {
                setEnableWarning({ name, need: plugin.minChannels, have: channelCount });
                return;
            }
            applyToggle(name, next);
        },
        [plugins, channelCount, applyToggle],
    );

    const addChannels = async (need: number) => {
        if (!socket) return;
        setAddingChannels(true);
        const [err, cfg] = await noTryAsync(() => socket.caspar.getConfig());
        if (err || !cfg) { setAddingChannels(false); return; }
        const defaultMode = cfg.videoModes[0]?.id ?? '1920x1080p5000';
        const toAdd = need - cfg.channels.length;
        if (toAdd > 0) {
            const updated = {
                ...cfg,
                channels: [
                    ...cfg.channels,
                    ...Array.from({ length: toAdd }, () => ({
                        videoMode: defaultMode,
                        consumers: [] as typeof cfg.channels[number]['consumers'],
                    })),
                ],
            };
            await noTryAsync(() => socket.caspar.updateConfig(updated));
        }
        setAddingChannels(false);
        setChannelPrompt(null);
        setShowRestartPrompt(true);
    };

    const confirmUninstall = async () => {
        if (!uninstalling || !socket) return;
        const name = uninstalling;
        setUninstalling(null);
        const [err] = await noTryAsync(() => socket.plugin.uninstall(name));
        if (err) {
            setError(err.message ?? t('pluginsPage.uninstall.error'));
        } else {
            setPlugins(prev => prev?.filter(p => p.name !== name) ?? prev);
        }
    };

    return (
        <DefaultContentLayout>
            <Dropzone
                fill
                onDrop={uploadCtrl.start}
                accept={['.cgplugin']}
                disabled={
                    uploadCtrl.state.phase === 'starting' ||
                    uploadCtrl.state.phase === 'uploading'
                }
                overlayLabel={t('pluginsPage.upload.dropOverlay')}
            >
                <Stack
                    direction="row"
                    alignItems="flex-start"
                    justifyContent="space-between"
                    gap={2}
                    mb={4}
                >
                    <Stack spacing={1}>
                        <Typography variant="h1">
                            {t('pluginsPage.title')}
                        </Typography>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('pluginsPage.description')}
                        </Typography>
                    </Stack>
                    <UploadButton
                        label={t('pluginsPage.upload.button')}
                        controller={uploadCtrl}
                        multiple={false}
                        types={[
                            {
                                description: t('pluginsPage.upload.fileType'),
                                accept: {
                                    'application/zip': ['.cgplugin'],
                                },
                            },
                        ]}
                    />
                </Stack>

                {error && (
                    <Card
                        sx={theme => ({
                            p: 2,
                            mb: 2,
                            borderColor: theme.palette.error.main,
                        })}
                    >
                        <Typography variant="body1" color="error">
                            {error}
                        </Typography>
                    </Card>
                )}

                {plugins === null && !error && (
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('actions.loading')}
                    </Typography>
                )}

                {plugins?.length === 0 && (
                    <Card sx={{ p: 3, textAlign: 'center' }}>
                        <Typography
                            variant="body1"
                            sx={{ color: 'text.secondary' }}
                        >
                            {t('pluginsPage.empty')}
                        </Typography>
                    </Card>
                )}

                <Stack spacing={1.5} sx={{ maxWidth: 720 }}>
                    {plugins?.map(plugin => (
                        <PluginCard
                            key={plugin.name}
                            plugin={plugin}
                            hasUi={pluginsWithUi.has(plugin.name)}
                            channelCount={channelCount}
                            onToggle={next => togglePlugin(plugin.name, next)}
                            onOpen={() =>
                                router.push(`/plugins/${plugin.name}`)
                            }
                            onUninstall={() => setUninstalling(plugin.name)}
                        />
                    ))}
                </Stack>
            </Dropzone>

            <UploadModal
                state={uploadCtrl.state}
                onClose={uploadCtrl.reset}
                onCancel={uploadCtrl.cancel}
                onConfirm={uploadCtrl.confirm}
                targetPathFor={file => file.name}
                optionsZone={null}
            />

            {/* Force-enable warning (insufficient channels) */}
            <Modal open={Boolean(enableWarning)} onClose={() => setEnableWarning(null)}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                >
                    <Card
                        sx={theme => ({
                            p: 3,
                            width: 480,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <WarningAmberRoundedIcon sx={{ color: 'warning.main' }} />
                                <Typography variant="h3">
                                    {t('pluginsPage.channels.enableWarning.title')}
                                </Typography>
                            </Stack>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                {t('pluginsPage.channels.enableWarning.body', {
                                    name: enableWarning?.name,
                                    need: enableWarning?.need,
                                    have: enableWarning?.have,
                                })}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button color="inherit" onClick={() => setEnableWarning(null)}>
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    onClick={() => {
                                        const name = enableWarning!.name;
                                        setEnableWarning(null);
                                        applyToggle(name, true);
                                    }}
                                >
                                    {t('pluginsPage.channels.enableWarning.confirm')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            {/* Install-time channel-add prompt */}
            <Modal open={Boolean(channelPrompt)} onClose={() => setChannelPrompt(null)}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                >
                    <Card
                        sx={theme => ({
                            p: 3,
                            width: 480,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <WarningAmberRoundedIcon sx={{ color: 'warning.main' }} />
                                <Typography variant="h3">
                                    {t('pluginsPage.channels.addPrompt.title')}
                                </Typography>
                            </Stack>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                {t('pluginsPage.channels.addPrompt.body', {
                                    name: channelPrompt?.name,
                                    need: channelPrompt?.need,
                                    have: channelPrompt?.have,
                                    add: (channelPrompt?.need ?? 0) - (channelPrompt?.have ?? 0),
                                })}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button color="inherit" onClick={() => setChannelPrompt(null)}>
                                    {t('pluginsPage.channels.addPrompt.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={addingChannels}
                                    onClick={() => addChannels(channelPrompt!.need)}
                                >
                                    {t('pluginsPage.channels.addPrompt.add', {
                                        add: (channelPrompt?.need ?? 0) - (channelPrompt?.have ?? 0),
                                    })}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            {/* Restart prompt after channel add */}
            <Modal open={showRestartPrompt} onClose={() => setShowRestartPrompt(false)}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                >
                    <Card
                        sx={theme => ({
                            p: 3,
                            width: 460,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Typography variant="h3">
                                {t('pluginsPage.channels.restartPrompt.title')}
                            </Typography>
                            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                {t('pluginsPage.channels.restartPrompt.body')}
                            </Typography>
                            <Stack direction="row" justifyContent="flex-end" gap={1}>
                                <Button color="inherit" onClick={() => setShowRestartPrompt(false)}>
                                    {t('pluginsPage.channels.restartPrompt.later')}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={restarting}
                                    onClick={async () => {
                                        setRestarting(true);
                                        await noTryAsync(() => socket!.caspar.restart());
                                        setRestarting(false);
                                        setShowRestartPrompt(false);
                                    }}
                                >
                                    {restarting
                                        ? t('config.restarting')
                                        : t('pluginsPage.channels.restartPrompt.restartNow')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            {/* Uninstall confirm dialog */}
            <Modal
                open={Boolean(uninstalling)}
                onClose={() => setUninstalling(null)}
            >
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <Card
                        sx={theme => ({
                            p: 3,
                            width: 460,
                            bgcolor: theme.palette.surface.elevated,
                            border: `1px solid ${theme.palette.divider}`,
                        })}
                    >
                        <Stack spacing={2}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                            >
                                <WarningAmberRoundedIcon
                                    sx={{ color: '#e88c8c' }}
                                />
                                <Typography variant="h3">
                                    {t('pluginsPage.uninstall.title')}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('pluginsPage.uninstall.body', {
                                    name: uninstalling,
                                })}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={() => setUninstalling(null)}
                                >
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={confirmUninstall}
                                >
                                    {t('pluginsPage.uninstall.confirm')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;
