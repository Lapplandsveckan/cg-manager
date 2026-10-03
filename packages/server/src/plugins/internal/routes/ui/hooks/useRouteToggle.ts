import { useCallback } from 'react';
import { noTryAsync } from 'no-try';
import { useTranslation } from 'react-i18next';
import { liveId, runMutation, useMutationSpec, useToast } from '@web-lib';
import { routeSetEnabled } from '../query';
import { routeKey, routeUndo } from '../undo';

export function useRouteToggle() {
    const { t } = useTranslation('common');
    const notify = useToast();
    const setEnabled = useMutationSpec(routeSetEnabled);
    const setEnabledAsync = setEnabled.mutateAsync;

    return useCallback(
        async (id: string, next: boolean) => {
            const [err, updated] = await noTryAsync(() =>
                setEnabledAsync({ id, enabled: next }),
            );
            if (err) {
                notify(
                    (err as Error)?.message ??
                        t('videoRoutes.errors.toggleFailed'),
                    'error',
                );
                return;
            }

            routeUndo.record({
                label: {
                    key: next ? 'routeEnable' : 'routeDisable',
                    params: { name: updated.name },
                },
                scopes: [routeKey(id)],
                prev: !next,
                next,
                apply: (enabled, { api }) =>
                    runMutation(routeSetEnabled, api, {
                        id: liveId(id),
                        enabled,
                    }),
            });
        },
        [setEnabledAsync, notify, t],
    );
}
