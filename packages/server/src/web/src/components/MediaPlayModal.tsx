import { Modal } from '@mui/material';
import React from 'react';
import { Injections, UI_INJECTION_ZONE } from '../lib/api/inject';
import { InstantPlayoutContext } from './RundownEditor';
import { ModalShell } from './RundownModals';
import { type RundownEntry } from './Rundowns';
import { usePlayEntry } from '../lib/hooks/usePlayEntry';

interface Props {
    entry: RundownEntry | null;
    onClose: () => void;
    /** @deprecated onError is no longer used; errors are surfaced via toast. */
    onError?: () => void;
}

/** Opens the plugin-owned rundown editor for an existing media item but in
 *  instant-playout mode: pressing the primary button runs the item via
 *  /api/rundown/execute instead of persisting it to a rundown. */
const MediaPlayModal: React.FC<Props> = ({ entry, onClose }) => {
    const play = usePlayEntry();

    return (
        <Modal open={entry !== null} onClose={onClose}>
            <ModalShell>
                {entry !== null && (
                    <InstantPlayoutContext.Provider value={true}>
                        <Injections
                            zone={`${UI_INJECTION_ZONE.RUNDOWN_EDITOR}.${entry.type}`}
                            props={{
                                entry,
                                creating: true,
                                instant: true,
                                updateEntry: (built: RundownEntry) => {
                                    play(built);
                                    onClose();
                                },
                                deleteEntry: () => onClose(),
                            }}
                        />
                    </InstantPlayoutContext.Provider>
                )}
            </ModalShell>
        </Modal>
    );
};

export default MediaPlayModal;
