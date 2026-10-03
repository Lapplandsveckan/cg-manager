import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import { useSocket } from './useSocket';
import { useCasparStatusQuery } from '../query/caspar';
import { useToast } from '../../components/ToastProvider';

export type CasparAction = 'start' | 'stop' | 'restart';

export function useCasparActions() {
    const { t } = useTranslation('common');
    const socket = useSocket();
    const notify = useToast();
    const { data: status } = useCasparStatusQuery();
    const [busy, setBusy] = useState<CasparAction | null>(null);

    const supported = status?.supported ?? true;
    const running = status?.running ?? false;
    const idle = busy === null;

    const can = {
        start: supported && !running && idle,
        stop: running && idle,
        restart: supported && idle,
    };

    const run = async (action: CasparAction) => {
        if (!socket) return;

        setBusy(action);
        const [err] = await noTryAsync(() => socket.caspar[action]());
        const message = err
            ? ((err as Error)?.message ?? t(`serverPage.errors.${action}`))
            : t(`serverPage.success.${action}`);
        notify(message, err ? 'error' : 'success');
        setBusy(null);
    };

    return { busy, can, run };
}
