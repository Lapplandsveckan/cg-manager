import { useCallback } from 'react';
import { useTranslation } from 'next-i18next/pages';
import type { RundownEntry } from '../query/rundownEntries';
import { useSocket } from './useSocket';
import { useCasparOnline } from './useCasparOnline';
import { useToast } from '../../components/ToastProvider';

/** Returns a stable stop(entry) function that guards against CasparCG being offline. */
export function useStopEntry(): (entry: RundownEntry) => void {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const online = useCasparOnline();
    const notify = useToast();

    return useCallback(
        (entry: RundownEntry) => {
            if (!online) {
                notify(t('rundown.stop.offline'), 'warning');
                return;
            }
            conn.rundowns
                .stop(entry)
                .catch(() => notify(t('rundown.stop.failed'), 'error'));
        },
        [t, conn, online, notify],
    );
}
