import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Card, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next/pages';
import { Injection, UI_INJECTION_ZONE } from '../../../../lib/api/inject';
import { DefaultContentLayout } from '../../../../components/DefaultContentLayout';
import {
    useInjectionsByZone,
    usePluginInjectionsQuery,
} from '../../../../lib/query/pluginInjections';

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const { plugin, slug } = router.query;
    const pluginId = typeof plugin === 'string' ? plugin : undefined;
    const slugParts = Array.isArray(slug) ? slug : [];
    const pageKey = slugParts[0] ?? null;
    const restPath = slugParts.slice(1);

    const { data: manifestLoaded } = usePluginInjectionsQuery();
    const navbarPageInjections = useInjectionsByZone(
        UI_INJECTION_ZONE.NAVBAR_PAGE,
    );
    const injection = useMemo(() => {
        if (!pluginId || !manifestLoaded) return undefined;
        return (
            navbarPageInjections.find(inj => {
                if (inj.plugin !== pluginId) return false;
                const dot = inj.zone.indexOf('.');
                const key = dot === -1 ? null : inj.zone.slice(dot + 1);
                return key === pageKey;
            }) ?? null
        );
    }, [manifestLoaded, navbarPageInjections, pluginId, pageKey]);

    return (
        <DefaultContentLayout>
            {injection === undefined && (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {t('actions.loading')}
                </Typography>
            )}

            {injection === null && (
                <Card sx={{ p: 3, maxWidth: 720 }}>
                    <Typography variant="h3">
                        {t('extPage.notFoundTitle')}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{ color: 'text.secondary', mt: 1 }}
                    >
                        {t('extPage.notFoundBody')}
                    </Typography>
                </Card>
            )}

            {injection && (
                <Injection id={injection.id} props={{ path: restPath }} />
            )}
        </DefaultContentLayout>
    );
};

export default Page;
