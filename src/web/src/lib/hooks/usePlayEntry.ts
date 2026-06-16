import { useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import type { RundownEntry } from '../../components/Rundowns';
import { useSocket } from './useSocket';
import { useCasparOnline } from './useCasparOnline';
import { useToast } from '../../components/ToastProvider';

/** Returns a stable play(entry) function that guards against CasparCG being offline. */
export function usePlayEntry(): (entry: RundownEntry) => void {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const online = useCasparOnline();
    const notify = useToast();

    return useCallback((entry: RundownEntry) => {
        if (!online) {
            notify(t('rundown.play.offline'), 'warning');
            return;
        }
        conn?.rawRequest('/api/rundown/execute', 'ACTION', { entry })
            .catch(() => notify(t('rundown.play.failed'), 'error'));
    }, [t, conn, online, notify]);
}
