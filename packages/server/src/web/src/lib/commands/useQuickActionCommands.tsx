import { useTranslation } from 'react-i18next';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { CommandItem } from '../../components/commandPalette/types';
import type { RundownEntry } from '../query/rundownEntries';
import type { Rundown } from '../query/rundowns';

interface QuickActionCommandsArgs {
    sets: Rundown[];
    selectedId: string | null;
    entries: RundownEntry[];
    select: (id: string) => void;
    create: (name: string) => unknown;
    play: (entry: RundownEntry) => void;
}

export function useQuickActionCommands({
    sets,
    selectedId,
    entries,
    select,
    create,
    play,
}: QuickActionCommandsArgs) {
    const { t } = useTranslation('common');

    const setCommands = (): CommandItem[] =>
        sets.map(set => ({
            id: `quick.set.${set.id}`,
            label: set.name,
            disabled: set.id === selectedId,
            run: () => select(set.id),
        }));

    const entryCommands = (): CommandItem[] =>
        entries.map(entry => ({
            id: `quick.entry.${entry.id}`,
            label: entry.title || t('commandPalette.commands.untitledEntry'),
            description: entry.type,
            run: () => play(entry),
        }));

    useRegisterCommands(
        () => [
            {
                id: 'quick.select',
                label: t('commandPalette.commands.selectQuickSet'),
                icon: <BoltRoundedIcon fontSize="small" />,
                disabled: sets.length === 0,
                children: setCommands,
            },
            {
                id: 'quick.create',
                label: t('commandPalette.commands.newQuickSet'),
                icon: <AddRoundedIcon fontSize="small" />,
                prompt: {
                    placeholder: t(
                        'commandPalette.commands.quickSetPlaceholder',
                    ),
                    submitLabel: value =>
                        t('commandPalette.commands.createNamed', { value }),
                    submit: create,
                },
            },
            {
                id: 'quick.play',
                label: t('commandPalette.commands.playQuickAction'),
                icon: <PlayArrowRoundedIcon fontSize="small" />,
                disabled: entries.length === 0,
                children: entryCommands,
            },
        ],
        { section: t('commandPalette.sections.quickActions'), priority: 100 },
    );
}
