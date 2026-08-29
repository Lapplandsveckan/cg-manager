import { Card, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import { useSocket } from '../../lib/hooks/useSocket';
import { DefaultContentLayout } from '../../components/DefaultContentLayout';
import { UI_INJECTION_ZONE } from '../../lib/api/inject';
import {
    Dropzone,
    UploadButton,
    UploadModal,
    useFileUpload,
} from '../../components/Upload';
import { PluginCard } from '../../components/PluginCard';
import { PluginModals } from '../../components/PluginModals';
import { useToast } from '../../components/ToastProvider';
import {
    casparConfigUpdate,
    setCasparConfigInCache,
    useCasparConfigQuery,
} from '../../lib/query/caspar';
import { useMutationSpec } from '../../lib/query/mutations';
import { usePluginMutations, usePluginsQuery } from '../../lib/query/plugins';
import { useInjectionsForZone } from '../../lib/query/pluginInjections';

interface ChannelInfo {
    name: string;
    need: number;
    have: number;
}

const Page = () => {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();
    const notify = useToast();

    const { data: plugins, error } = usePluginsQuery();
    const pluginInjections = useInjectionsForZone(
        UI_INJECTION_ZONE.PLUGIN_PAGE,
    );
    const pluginsWithUi = new Set(pluginInjections.map(i => i.plugin));
    const { setEnabled, uninstall, setActiveVersion, deleteVersion } =
        usePluginMutations();
    const updateConfig = useMutationSpec(casparConfigUpdate);
    const { data: config } = useCasparConfigQuery();
    const channelCount = config?.channels.length ?? 0;
    const [uninstalling, setUninstalling] = useState<string | null>(null);
    const [deletingVersion, setDeletingVersion] = useState<{
        name: string;
        version: string;
        isLast: boolean;
    } | null>(null);
    const [enableWarning, setEnableWarning] = useState<ChannelInfo | null>(
        null,
    );
    const [channelPrompt, setChannelPrompt] = useState<ChannelInfo | null>(
        null,
    );
    const [showRestartPrompt, setShowRestartPrompt] = useState(false);
    const [addingChannels, setAddingChannels] = useState(false);
    const [restarting, setRestarting] = useState(false);
    const prevPluginNamesRef = useRef<Set<string> | null>(null);

    const uploadCtrl = useFileUpload({
        createUpload: file => socket.plugin.uploadPlugin(file),
    });

    // Detect newly installed plugins that need more channels than available,
    // by diffing consecutive broadcast payloads against the previous list.
    // Skip the check while the config hasn't resolved: a count of 0 would
    // prompt for every plugin with a channel requirement.
    useEffect(() => {
        if (!plugins) return;
        const prev = prevPluginNamesRef.current;
        const currentCount = config?.channels.length;
        if (prev && currentCount !== undefined) {
            for (const p of plugins) {
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
        }
        prevPluginNamesRef.current = new Set(plugins.map(p => p.name));
    }, [plugins, config]);

    const setEnabledAsync = setEnabled.mutateAsync;
    const applyToggle = useCallback(
        async (name: string, next: boolean) => {
            const [err] = await noTryAsync(() =>
                setEnabledAsync({ name, enabled: next }),
            );
            if (err) notify(t('pluginsPage.toggle.error'), 'error');
        },
        [setEnabledAsync, notify, t],
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
        setAddingChannels(true);
        // Fetch fresh rather than trusting the cache — this is a mutation
        // pre-read and another client may have just saved.
        const [err, cfg] = await noTryAsync(() => socket.caspar.getConfig());
        if (err || !cfg) {
            setAddingChannels(false);
            return;
        }
        setCasparConfigInCache(cfg);

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
            const [saveErr] = await noTryAsync(() =>
                updateConfig.mutateAsync(updated),
            );
            if (saveErr) {
                notify(
                    (saveErr as Error)?.message ??
                        t('config.errors.saveFailed'),
                    'error',
                );
                setAddingChannels(false);
                return;
            }
        }
        setAddingChannels(false);
        setChannelPrompt(null);
        setShowRestartPrompt(true);
    };

    const setActiveVersionAsync = setActiveVersion.mutateAsync;
    const selectVersion = useCallback(
        async (name: string, version: string) => {
            // The `plugins` broadcast reconciles the cache either way — no
            // patch needed here, including the case where the version bump
            // renamed the plugin's pluginName.
            const [err] = await noTryAsync(() =>
                setActiveVersionAsync({ name, version }),
            );
            if (err) notify(t('pluginsPage.versions.switchError'), 'error');
        },
        [setActiveVersionAsync, notify, t],
    );

    const requestDeleteVersion = useCallback(
        (name: string, version: string) => {
            const plugin = plugins?.find(p => p.name === name);
            setDeletingVersion({
                name,
                version,
                isLast: (plugin?.versions?.length ?? 0) <= 1,
            });
        },
        [plugins],
    );

    const confirmDeleteVersion = async () => {
        if (!deletingVersion) return;
        const { name, version } = deletingVersion;
        setDeletingVersion(null);
        const [err] = await noTryAsync(() =>
            deleteVersion.mutateAsync({ name, version }),
        );
        if (err) notify(t('pluginsPage.versions.deleteError'), 'error');
        // The server-pushed `plugins` broadcast refreshes the list —
        // including dropping the plugin entirely if this was its last version.
    };

    const confirmUninstall = async () => {
        if (!uninstalling) return;
        const name = uninstalling;
        setUninstalling(null);
        const [err] = await noTryAsync(() => uninstall.mutateAsync(name));
        if (err)
            notify(err.message || t('pluginsPage.uninstall.error'), 'error');
        else notify(t('pluginsPage.uninstall.success'), 'success');
    };

    const handleRestart = useCallback(async () => {
        setRestarting(true);
        await noTryAsync(() => socket.caspar.restart());
        setRestarting(false);
        setShowRestartPrompt(false);
    }, [socket]);

    const errorMessage = error
        ? error.message || t('pluginsPage.loadError')
        : null;

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

                {errorMessage && (
                    <Card
                        sx={theme => ({
                            p: 2,
                            mb: 2,
                            borderColor: theme.palette.error.main,
                        })}
                    >
                        <Typography variant="body1" color="error">
                            {errorMessage}
                        </Typography>
                    </Card>
                )}

                {plugins === undefined && !errorMessage && (
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
                            onSelectVersion={version =>
                                selectVersion(plugin.name, version)
                            }
                            onDeleteVersion={version =>
                                requestDeleteVersion(plugin.name, version)
                            }
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
                deletingVersion={deletingVersion}
                onDeleteVersionClose={() => setDeletingVersion(null)}
                onConfirmDeleteVersion={confirmDeleteVersion}
            />
        </DefaultContentLayout>
    );
};

export default Page;
