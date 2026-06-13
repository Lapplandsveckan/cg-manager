import { Card, Stack, Typography } from '@mui/material';
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
import { PluginCard } from '../../components/PluginCard';
import { PluginModals } from '../../components/PluginModals';

interface ChannelInfo {
    name: string;
    need: number;
    have: number;
}

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();

    const [plugins, setPlugins] = useState<Plugin[] | null>(null);
    const [pluginsWithUi, setPluginsWithUi] = useState<Set<string>>(new Set());
    const [channelCount, setChannelCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [enableWarning, setEnableWarning] = useState<ChannelInfo | null>(
        null,
    );
    const [channelPrompt, setChannelPrompt] = useState<ChannelInfo | null>(
        null,
    );
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
                        if (
                            !prev.has(p.name) &&
                            p.minChannels > 0 &&
                            p.minChannels > currentCount
                        ) {
                            setChannelPrompt({
                                name: p.name,
                                need: p.minChannels,
                                have: currentCount,
                            });
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
            if (!next) {
                applyToggle(name, next);
                return;
            }
            const plugin = plugins?.find(p => p.name === name);
            if (plugin && plugin.minChannels > channelCount) {
                setEnableWarning({
                    name,
                    need: plugin.minChannels,
                    have: channelCount,
                });
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
        if (err || !cfg) {
            setAddingChannels(false);
            return;
        }
        const defaultMode = cfg.videoModes[0]?.id ?? '1920x1080p5000';
        const toAdd = need - cfg.channels.length;
        if (toAdd > 0) {
            const updated = {
                ...cfg,
                channels: [
                    ...cfg.channels,
                    ...Array.from({ length: toAdd }, () => ({
                        videoMode: defaultMode,
                        consumers:
                            [] as (typeof cfg.channels)[number]['consumers'],
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

    const handleRestart = useCallback(async () => {
        setRestarting(true);
        await noTryAsync(() => socket!.caspar.restart());
        setRestarting(false);
        setShowRestartPrompt(false);
    }, [socket]);

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

            <PluginModals
                enableWarning={enableWarning}
                onEnableWarningClose={() => setEnableWarning(null)}
                onForceEnable={name => {
                    setEnableWarning(null);
                    applyToggle(name, true);
                }}
                channelPrompt={channelPrompt}
                onChannelPromptClose={() => setChannelPrompt(null)}
                addingChannels={addingChannels}
                onAddChannels={addChannels}
                showRestartPrompt={showRestartPrompt}
                onRestartPromptClose={() => setShowRestartPrompt(false)}
                restarting={restarting}
                onRestart={handleRestart}
                uninstalling={uninstalling}
                onUninstallClose={() => setUninstalling(null)}
                onConfirmUninstall={confirmUninstall}
            />
        </DefaultContentLayout>
    );
};

export default Page;
