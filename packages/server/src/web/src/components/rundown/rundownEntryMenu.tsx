import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { type TFunction } from 'i18next';
import { type ContextMenuItem } from '../ContextMenuProvider';
import { type RundownEntry } from '../../lib/query/rundownEntries';

interface RundownEntryMenuOptions {
    entry: RundownEntry;
    index: number;
    isOrphaned: boolean;
    onEdit: () => void;
    onPlay: () => void;
    onDuplicate?: (entry: RundownEntry, index: number) => void;
    onCopy: (entry: RundownEntry) => void;
    onPaste: () => void;
    onRequestDelete: () => void;
    hasClipboardEntry: boolean;
}

export function rundownEntryMenuItems(
    t: TFunction,
    options: RundownEntryMenuOptions,
): ContextMenuItem[] {
    const { entry, index, isOrphaned } = options;

    return [
        {
            label: t('actions.edit'),
            icon: <EditOutlinedIcon fontSize="small" />,
            onClick: options.onEdit,
        },
        {
            label: t('actions.play'),
            icon: <PlayArrowRoundedIcon fontSize="small" />,
            disabled: isOrphaned,
            onClick: options.onPlay,
        },
        {
            label: t('actions.duplicate'),
            icon: <ContentCopyRoundedIcon fontSize="small" />,
            divider: true,
            onClick: () => options.onDuplicate?.(entry, index),
        },
        {
            label: t('actions.copy'),
            onClick: () => options.onCopy(entry),
        },
        {
            label: t('actions.paste'),
            disabled: !options.hasClipboardEntry,
            onClick: options.onPaste,
        },
        {
            label: t('actions.delete'),
            icon: <DeleteOutlineRoundedIcon fontSize="small" />,
            danger: true,
            divider: true,
            onClick: options.onRequestDelete,
        },
    ];
}
