import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Card, Typography } from '@mui/material';
import { useTranslation } from 'next-i18next';
import {
    Injection,
    UI_INJECTION_ZONE,
    type Injection as Inject,
} from '../../../../lib/api/inject';
import { useSocket } from '../../../../lib';
import { DefaultContentLayout } from '../../../../components/DefaultContentLayout';

const Page = () => {
    const { t } = useTranslation('common');
    const router = useRouter();
    const socket = useSocket();
    const { plugin, slug } = router.query;
    const pluginId = typeof plugin === 'string' ? plugin : undefined;
    const slugParts = Array.isArray(slug) ? slug : [];
    const pageKey = slugParts[0] ?? null;
    const restPath = slugParts.slice(1);

    const [injection, setInjection] = useState<Inject | null | undefined>(
        undefined,
    );

    useEffect(() => {
        if (!socket || !pluginId) return;
        let mounted = true;

        socket.injects
            .getInjectsByZone(UI_INJECTION_ZONE.NAVBAR_PAGE)
            .then(injections => {
                if (!mounted) return;
                const match = injections.find(inj => {
                    if (inj.plugin !== pluginId) return false;
                    const dot = inj.zone.indexOf('.');
                    const key = dot === -1 ? null : inj.zone.slice(dot + 1);
                    return key === pageKey;
                });
                setInjection(match ?? null);
            })
            .catch(() => {
                if (mounted) setInjection(null);
            });

        return () => {
            mounted = false;
        };
    }, [socket, pluginId, pageKey]);

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
