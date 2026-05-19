import {DefaultContentLayout} from '../../../../components/DefaultContentLayout';
import {useSocket} from '../../../../lib';
import {Injections, UI_INJECTION_ZONE} from '../../../../lib/api/inject';
import {Plugin} from '../../../../lib/api/plugin';
import {useRouter} from 'next/router';
import {useCallback, useEffect, useState} from 'react';
import {Box, Button, Card, Stack, Switch, Typography, alpha} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const StatusPill: React.FC<{ enabled: boolean }> = ({ enabled }) => {
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
                bgcolor: enabled ? alpha('#5fc97a', 0.1) : alpha(theme.palette.text.primary, 0.04),
                border: `1px solid ${enabled ? alpha('#5fc97a', 0.3) : theme.palette.divider}`,
            })}
        >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption" sx={{ color: enabled ? '#5fc97a' : 'text.secondary' }}>
                {enabled ? 'Active' : 'Disabled'}
            </Typography>
        </Stack>
    );
};

const Page = () => {
    const router = useRouter();
    const socket = useSocket();
    const {id, slug} = router.query;
    const pluginId = typeof id === 'string' ? id : undefined;

    const [plugin, setPlugin] = useState<Plugin | null | undefined>(undefined);
    const [hasUi, setHasUi] = useState(false);

    useEffect(() => {
        if (!socket || !pluginId) return;
        let mounted = true;

        Promise.all([
            socket.plugin.getPlugins(),
            socket.injects.getInjects(UI_INJECTION_ZONE.PLUGIN_PAGE, pluginId),
        ])
            .then(([plugins, injects]) => {
                if (!mounted) return;
                setPlugin(plugins.find(p => p.name === pluginId) ?? null);
                setHasUi(injects.length > 0);
            })
            .catch(e => mounted && console.error(`Failed to load plugin "${pluginId}"`, e));

        return () => { mounted = false; };
    }, [socket, pluginId]);

    const togglePlugin = useCallback(async (next: boolean) => {
        if (!socket || !pluginId) return;
        setPlugin(prev => prev ? { ...prev, enabled: next } : prev);
        try {
            const confirmed = await socket.plugin.setEnabled(pluginId, next);
            const settled = typeof confirmed === 'boolean' ? confirmed : next;
            setPlugin(prev => prev ? { ...prev, enabled: settled } : prev);
        } catch (e) {
            setPlugin(prev => prev ? { ...prev, enabled: !next } : prev);
            console.error(`Failed to toggle plugin "${pluginId}"`, e);
        }
    }, [socket, pluginId]);

    return (
        <DefaultContentLayout>
            <Button
                size="small"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={() => router.push('/plugins')}
                sx={{ mb: 2, color: 'text.secondary', alignSelf: 'flex-start' }}
            >
                Plugins
            </Button>

            {plugin === undefined && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading…</Typography>
            )}

            {plugin === null && (
                <Card sx={{ p: 3, maxWidth: 720 }}>
                    <Typography variant="h3">Plugin not found</Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
                        No plugin called &ldquo;{pluginId}&rdquo; is registered.
                    </Typography>
                </Card>
            )}

            {plugin && (
                <>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} mb={1}>
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <Typography variant="h1">{plugin.name}</Typography>
                            <StatusPill enabled={plugin.enabled} />
                        </Stack>
                        <Switch
                            color="primary"
                            checked={plugin.enabled}
                            onChange={(_, checked) => togglePlugin(checked)}
                            inputProps={{ 'aria-label': `Toggle ${plugin.name}` }}
                        />
                    </Stack>

                    {hasUi ? (
                        <Box sx={{ mt: 3 }}>
                            <Injections
                                zone={UI_INJECTION_ZONE.PLUGIN_PAGE}
                                plugin={pluginId}
                                props={{ path: slug }}
                            />
                        </Box>
                    ) : (
                        <Card sx={{ p: 3, mt: 3, maxWidth: 720 }}>
                            <Typography variant="h3">No configuration UI</Typography>
                            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 1 }}>
                                This plugin doesn&apos;t provide a configuration panel. It&apos;s
                                controlled directly through the plugin&apos;s code, the
                                CasparCG config, or a file in the project&apos;s plugin folder.
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 2 }}>
                                You can still enable or disable it with the switch above.
                            </Typography>
                        </Card>
                    )}
                </>
            )}
        </DefaultContentLayout>
    );
};

export default Page;
