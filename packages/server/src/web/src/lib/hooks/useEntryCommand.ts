import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { RundownEntry } from '../query/rundownEntries';
import { useSocket } from './useSocket';
import { useCasparOnline } from './useCasparOnline';
import { useToast } from '../../components/ToastProvider';

const method = { play: 'execute', stop: 'stop' } as const;

export function useEntryCommand(
    kind: 'play' | 'stop',
): (entry: RundownEntry) => void {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const online = useCasparOnline();
    const notify = useToast();

    return useCallback(
        (entry: RundownEntry) => {
            if (!online) {
                notify(t(`rundown.${kind}.offline`), 'warning');
                return;
            }
            conn.rundowns[method[kind]](entry).catch(() =>
                notify(t(`rundown.${kind}.failed`), 'error'),
            );
        },
        [kind, t, conn, online, notify],
    );
}
