import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { noTryAsync } from 'no-try';
import { useToast } from '../../components/ToastProvider';
import { type CasparConfig } from '../api/caspar';
import { useLatest } from '../hooks/useLatest';
import { record } from '../undo/undoStore';
import { CONFIG_SCOPE, UndoStaleError } from '../undo/tools';
import { useMutationSpec, runMutation } from '../query/mutations';
import {
    casparConfigUpdate,
    setCasparConfigInCache,
    useCasparConfigQuery,
    useRunningConfigQuery,
} from '../query/caspar';
import { stableStringify } from './stableStringify';

type Channel = CasparConfig['channels'][number];

const blankChannel = (videoMode: string): Channel => ({
    videoMode,
    consumers: [],
});

export function useConfigDraft() {
    const { t } = useTranslation('common');
    const notify = useToast();
    const configQuery = useCasparConfigQuery();
    const original = configQuery.data ?? null;
    // Running snapshot — used only to detect drift. When CasparCG is off
    // there's nothing to drift from, so we suppress the banner in that case.
    const { data: runningData } = useRunningConfigQuery();
    const running = runningData ?? null;
    const [draft, setDraft] = useState<CasparConfig | null>(null);
    const saveConfig = useMutationSpec(casparConfigUpdate);
    const saving = saveConfig.isPending;
    const error = configQuery.error
        ? configQuery.error.message || t('config.errors.loadFailed')
        : null;

    // Drift = saved config differs from what's actually running. Compare
    // against `original` (last save) so the banner only shows when the
    // saved-and-on-disk state already differs — un-saved drafts get the
    // existing Save button, not this banner. Stringify for a structural
    // compare so deeply-equal configs don't false-positive.
    const drift = useMemo(() => {
        if (!original || !running) return false;
        return stableStringify(original) !== stableStringify(running);
    }, [original, running]);

    const dirty = useMemo(() => {
        if (!original || !draft) return false;
        return stableStringify(original) !== stableStringify(draft);
    }, [original, draft]);
    const dirtyRef = useLatest(dirty);

    // `original` can change under the user at any time — a remote client's
    // save (via the `caspar/config` broadcast) or a Ctrl+Z undo apply, both
    // of which write the cache. Follow it into the draft only while the user
    // has no unsaved edits — a dirty draft is theirs to keep, and the Save
    // button stays live.
    useEffect(() => {
        if (!original) return;
        if (!dirtyRef.current) setDraft(original);
    }, [original, dirtyRef]);

    const save = async () => {
        if (!draft || saving) return;

        const [err, saved] = await noTryAsync(() =>
            saveConfig.mutateAsync(draft),
        );
        if (err) {
            notify(
                err instanceof Error
                    ? err.message
                    : t('config.errors.saveFailed'),
                'error',
            );
            return;
        }
        if (!saved) return;

        const before = original;
        setDraft(saved);
        notify(t('config.success.saved'), 'success');
        if (!before) return;

        record({
            label: { key: 'configSave' },
            scopes: [CONFIG_SCOPE],
            prev: before,
            next: saved,
            apply: async (cfg, { api, direction }) => {
                if (direction === 'undo') {
                    // Staleness pre-check hits the server directly, not
                    // `queryClient.fetchQuery` — that would dedupe against
                    // an in-flight background refetch and compare against a
                    // response older than "now", defeating the check. Still
                    // write the fresh read through the cache as a side
                    // effect, same as the mutation's own patch would.
                    const current = await api.caspar.getConfig();
                    setCasparConfigInCache(current);
                    if (stableStringify(current) !== stableStringify(saved))
                        throw new UndoStaleError();
                }
                await runMutation(casparConfigUpdate, api, cfg);
            },
        });
    };

    const discard = () => {
        if (original) setDraft(original);
    };

    const updateDraft = (patch: Partial<CasparConfig>) =>
        setDraft(d => (d ? { ...d, ...patch } : d));

    const updateChannel = (i: number, channel: Channel) =>
        setDraft(d =>
            d
                ? {
                      ...d,
                      channels: d.channels.map((c, idx) =>
                          idx === i ? channel : c,
                      ),
                  }
                : d,
        );

    const deleteChannel = (i: number) =>
        setDraft(d =>
            d
                ? { ...d, channels: d.channels.filter((_, idx) => idx !== i) }
                : d,
        );

    const addChannel = () =>
        setDraft(d => {
            if (!d) return d;
            const defaultMode = d.videoModes[0]?.id ?? '1920x1080p5000';
            return {
                ...d,
                channels: [...d.channels, blankChannel(defaultMode)],
            };
        });

    return {
        draft,
        dirty,
        drift,
        saving,
        error,
        save,
        discard,
        updateDraft,
        updateChannel,
        deleteChannel,
        addChannel,
    };
}
