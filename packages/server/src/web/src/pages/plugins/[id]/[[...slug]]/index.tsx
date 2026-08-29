import { useRouter } from 'next/router';
import { useCallback, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    Stack,
    Switch,
    Typography,
    alpha,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'next-i18next';
import { Injections, UI_INJECTION_ZONE } from '../../../../lib/api/inject';
import { DefaultContentLayout } from '../../../../components/DefaultContentLayout';
import { useToast } from '../../../../components/ToastProvider';
import {
    usePluginMutations,
    usePluginQuery,
    usePluginsQuery,
} from '../../../../lib/query/plugins';
import { useInjectionsForZone } from '../../../../lib/query/pluginInjections';

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

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const notify = useToast();
    const { id, slug } = router.query;
    const pluginId = typeof id === 'string' ? id : undefined;

    const { error } = usePluginsQuery();
    const plugin = usePluginQuery(pluginId);
    const injections = useInjectionsForZone(
        UI_INJECTION_ZONE.PLUGIN_PAGE,
        pluginId ?? null,
    );
    const hasUi = injections.length > 0;
    const { setEnabled } = usePluginMutations();

    useEffect(() => {
        if (error) notify(error.message || t('pluginsPage.loadError'), 'error');
    }, [error, notify, t]);

    const setEnabledAsync = setEnabled.mutateAsync;
    const togglePlugin = useCallback(
        async (next: boolean) => {
            if (!pluginId) return;
            const [err] = await noTryAsync(() =>
                setEnabledAsync({ name: pluginId, enabled: next }),
            );
            if (err) notify(t('pluginsPage.toggle.error'), 'error');
        },
        [pluginId, setEnabledAsync, notify, t],
    );

    return (
        <DefaultContentLayout>
            <Button
                size="small"
                startIcon={<ArrowBackIcon fontSize="small" />}
                onClick={() => router.push('/plugins')}
                sx={{ mb: 2, color: 'text.secondary', alignSelf: 'flex-start' }}
            >
                {t('nav.plugins')}
            </Button>

            {plugin === undefined && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('actions.loading')}
                </Typography>
            )}

            {plugin === null && (
                <Card sx={{ p: 3, maxWidth: 720 }}>
                    <Typography variant="h3">
                        {t('pluginsPage.detail.notFoundTitle')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{ color: 'text.secondary', mt: 1 }}
                    >
                        {t('pluginsPage.detail.notFoundBody', { id: pluginId })}
                    </Typography>
                </Card>
            )}

            {plugin && (
                <>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        gap={2}
                        mb={1}
                    >
                        <Stack direction="row" alignItems="center" gap={1.5}>
                            <Typography variant="h1">{plugin.name}</Typography>
                            <StatusPill enabled={plugin.enabled} />
                        </Stack>
                        <Switch
                            color="primary"
                            checked={plugin.enabled}
                            onChange={(_, checked) => togglePlugin(checked)}
                            inputProps={{
                                'aria-label': t('pluginsPage.togglePlugin', {
                                    name: plugin.name,
                                }),
                            }}
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
                            <Typography variant="h3">
                                {t('pluginsPage.detail.noUiTitle')}
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary', mt: 1 }}
                            >
                                {t('pluginsPage.detail.noUiBody')}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.disabled', mt: 2 }}
                            >
                                {t('pluginsPage.detail.noUiHint')}
                            </Typography>
                        </Card>
                    )}
                </>
            )}
        </DefaultContentLayout>
    );
};

export default Page;
