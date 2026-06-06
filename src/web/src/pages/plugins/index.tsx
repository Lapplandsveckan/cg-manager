import {Box, Card, Stack, Switch, Typography, alpha} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {useCallback, useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {useTranslation} from 'next-i18next';
import {useSocket} from '../../lib/hooks/useSocket';
import {DefaultContentLayout} from '../../components/DefaultContentLayout';
import {type Plugin} from '../../lib/api/plugin';
import {UI_INJECTION_ZONE} from '../../lib/api/inject';

interface PluginCardProps {
    plugin: Plugin;
    hasUi: boolean;
    onToggle: (next: boolean) => void;
    onOpen: () => void;
}

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
    const {t} = useTranslation('common');
    const color = enabled ? '#5fc97a' : 'rgba(232, 234, 237, 0.4)';
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={(theme) => ({
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: enabled
                    ? alpha('#5fc97a', 0.1)
                    : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}>
                {enabled ? t('pluginsPage.status.active') : t('pluginsPage.status.disabled')}
            </Typography>
        </Stack>
    );
};

const PluginCard: React.FC<PluginCardProps> = ({ plugin, hasUi, onToggle, onOpen }) => {
    const {t} = useTranslation('common');
    return (
        <Card
            onClick={onOpen}
            sx={(theme) => ({
                p: 2.5,
                cursor: 'pointer',
                transition: theme.transitions.create(['border-color', 'background-color'], { duration: 120 }),
                '&:hover': {
                    borderColor: alpha(theme.palette.primary.main, 0.45),
                    bgcolor: theme.palette.surface.elevated,
                },
            })}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Stack spacing={0.5} sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1.25}>
                        <Typography variant="h4" sx={{ wordBreak: 'break-word' }}>
                            {plugin.name}
                        </Typography>
                        <StatusPill enabled={plugin.enabled} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {hasUi
                            ? t('pluginsPage.card.openForConfig')
                            : t('pluginsPage.card.noUi')}
                    </Typography>
                </Stack>

                <Stack
                    direction="row"
                    alignItems="center"
                    gap={1}
                    sx={{ flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Switch
                        color="primary"
                        checked={plugin.enabled}
                        onChange={(_, checked) => onToggle(checked)}
                        inputProps={{ 'aria-label': t('pluginsPage.togglePlugin', {name: plugin.name}) }}
                    />
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
    const {t} = useTranslation('common');
    const socket = useSocket();
    const router = useRouter();

    const [plugins, setPlugins] = useState<Plugin[] | null>(null);
    const [pluginsWithUi, setPluginsWithUi] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!socket) return;
        let mounted = true;

        Promise.all([
            socket.plugin.getPlugins(),
            socket.injects.getInjects(UI_INJECTION_ZONE.PLUGIN_PAGE),
        ])
            .then(([list, injects]) => {
                if (!mounted) return;
                setPlugins(list);
                setPluginsWithUi(new Set(injects.map(i => i.plugin)));
            })
            .catch(e => mounted && setError(e?.message ?? t('pluginsPage.loadError')));

        return () => { mounted = false; };
    }, [socket]);

    const togglePlugin = useCallback(async (name: string, next: boolean) => {
        if (!socket) return;
        setPlugins(prev => prev?.map(p => p.name === name ? { ...p, enabled: next } : p) ?? prev);
        try {
            const confirmed = await socket.plugin.setEnabled(name, next);
            // Guard: if the server response shape is unexpected, keep the optimistic value
            // rather than poisoning the controlled state with undefined.
            const settled = typeof confirmed === 'boolean' ? confirmed : next;
            setPlugins(prev => prev?.map(p => p.name === name ? { ...p, enabled: settled } : p) ?? prev);
        } catch (e) {
            setPlugins(prev => prev?.map(p => p.name === name ? { ...p, enabled: !next } : p) ?? prev);
            console.error(`Failed to toggle plugin "${name}"`, e);
        }
    }, [socket]);

    return (
        <DefaultContentLayout>
            <Stack spacing={1} mb={4}>
                <Typography variant="h1">{t('pluginsPage.title')}</Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                    {t('pluginsPage.description')}
                </Typography>
            </Stack>

            {error && (
                <Card sx={(theme) => ({ p: 2, mb: 2, borderColor: theme.palette.error.main })}>
                    <Typography variant="body1" color="error">{error}</Typography>
                </Card>
            )}

            {plugins === null && !error && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>{t('actions.loading')}</Typography>
            )}

            {plugins?.length === 0 && (
                <Card sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
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
                        onToggle={(next) => togglePlugin(plugin.name, next)}
                        onOpen={() => router.push(`/plugins/${plugin.name}`)}
                    />
                ))}
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;
