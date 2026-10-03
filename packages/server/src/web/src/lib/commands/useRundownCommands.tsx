import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { CommandItem } from '../../components/commandPalette/types';
import { useEntryClipboard } from '../../components/EntryClipboardProvider';
import { useRundownActionsQuery } from '../query/rundownMeta';
import type { RundownEntry } from '../query/rundownEntries';

interface RundownCommandsArgs {
    name: string;
    entries: RundownEntry[];
    locked: boolean;
    setLocked: (locked: boolean) => void;
    setAdding: (adding: boolean) => void;
    play: (entry: RundownEntry) => void;
    stop: (entry: RundownEntry) => void;
    paste: (entry: RundownEntry, index: number) => unknown;
    rename: (name: string) => unknown;
}

export function useRundownCommands({
    name,
    entries,
    locked,
    setLocked,
    setAdding,
    play,
    stop,
    paste,
    rename,
}: RundownCommandsArgs) {
    const { t } = useTranslation('common');
    const clipboard = useEntryClipboard();
    const { data: actions } = useRundownActionsQuery();

    const stoppableTypes = useMemo(
        () => new Set((actions ?? []).filter(a => a.hasStop).map(a => a.id)),
        [actions],
    );

    const pasteAtEnd = () => {
        const copied = clipboard.paste();
        if (copied) paste(copied, entries.length - 1);
    };

    const entryCommands =
        (
            run: (entry: RundownEntry) => void,
            only?: (e: RundownEntry) => boolean,
        ) =>
        (): CommandItem[] =>
            entries
                .filter(entry => only?.(entry) ?? true)
                .map(entry => ({
                    id: `rundown.entry.${entry.id}`,
                    label:
                        entry.title ||
                        t('commandPalette.commands.untitledEntry'),
                    description: entry.type,
                    run: () => run(entry),
                }));

    const isStoppable = (entry: RundownEntry) =>
        Boolean(entry.type && stoppableTypes.has(entry.type));

    useRegisterCommands(
        () => [
            {
                id: 'rundown.add',
                label: t('commandPalette.commands.addEntry'),
                icon: <AddRoundedIcon fontSize="small" />,
                run: () => setAdding(true),
            },
            {
                id: 'rundown.play',
                label: t('commandPalette.commands.playEntry'),
                icon: <PlayArrowRoundedIcon fontSize="small" />,
                disabled: entries.length === 0,
                children: entryCommands(play),
            },
            {
                id: 'rundown.stop',
                label: t('commandPalette.commands.stopEntry'),
                icon: <StopRoundedIcon fontSize="small" />,
                disabled: !entries.some(isStoppable),
                children: entryCommands(stop, isStoppable),
            },
            {
                id: 'rundown.paste',
                label: t('commandPalette.commands.pasteEntry'),
                icon: <ContentPasteRoundedIcon fontSize="small" />,
                disabled: !clipboard.hasEntry,
                run: pasteAtEnd,
            },
            {
                id: 'rundown.rename',
                label: t('commandPalette.commands.renameRundown'),
                icon: <EditRoundedIcon fontSize="small" />,
                prompt: {
                    placeholder: t('commandPalette.commands.renamePlaceholder'),
                    initial: name,
                    submitLabel: value =>
                        t('commandPalette.commands.renameTo', { value }),
                    submit: rename,
                },
            },
            {
                id: 'rundown.mode',
                label: t(
                    locked
                        ? 'commandPalette.commands.switchToLive'
                        : 'commandPalette.commands.switchToEdit',
                ),
                icon: <SwapHorizRoundedIcon fontSize="small" />,
                run: () => setLocked(!locked),
            },
        ],
        { section: t('commandPalette.sections.rundown'), priority: 100 },
    );
}
