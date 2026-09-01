import { Box, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'next-i18next/pages';
import { useRundownCardDrag } from '../../hooks/useRundownCardDrag';
import { DropIndicatorGap } from './DropIndicatorGap';
import { RundownDragHandle } from './RundownDragHandle';
import { RundownEntryTitleRow } from './RundownEntryTitleRow';
import { rundownCardSx } from './rundownCardStyle';

interface RundownEntryCardProps {
    title: string;

    onEdit: () => void;
    onPlay: () => void;
    onStop?: () => void;
    onDelete?: () => void;

    /** When true (edit mode), clicking the card body opens the editor; in live
     *  mode it fires onPlay. The play button always fires onPlay regardless. */
    locked?: boolean;
    disabled?: boolean;
    children: React.ReactNode;

    /** Drag handle wiring — when provided, a grip icon appears on the left
     *  edge and is the only element that initiates a reorder drag. */
    onReorderDragStart?: (
        e: React.DragEvent<HTMLDivElement>,
        height: number,
        grabOffset: number,
    ) => void;
    onReorderDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
    /** When set, an animated gap opens above/below the card to show where the
     *  dragged item will land. */
    dropIndicator?: 'before' | 'after' | null;
    /** Height of the gap in px. Defaults to 64. */
    gapHeight?: number;
    /** Collapses this card (source of the active drag) so the list closes up. */
    isDragging?: boolean;
}

export const RundownEntryCard: React.FC<RundownEntryCardProps> = ({
    title,
    onEdit,
    onPlay,
    onStop,
    onDelete,
    locked,
    disabled,
    children,
    onReorderDragStart,
    onReorderDragEnd,
    dropIndicator,
    gapHeight = 64,
    isDragging,
}) => {
    const { t } = useTranslation('common');
    const { cardRef, handleDragStart, handleDragEnd } = useRundownCardDrag({
        onReorderDragStart,
        onReorderDragEnd,
    });

    const cardClickable = !disabled;
    const supportsReorder = Boolean(onReorderDragStart);
    // Reorder is an editing affordance — only show/allow it when the rundown
    // is locked (edit mode). In show mode the slot is reserved but hidden so
    // the card layout doesn't jump when toggling modes.
    const draggable = supportsReorder && Boolean(locked);

    const handleCardClick = (e: React.MouseEvent) => {
        if (!cardClickable) return;
        e.stopPropagation();

        const action = locked ? onEdit : onPlay;
        action();
    };

    return (
        <Box sx={{ position: 'relative' }}>
            <DropIndicatorGap
                open={dropIndicator === 'before'}
                height={gapHeight}
            />

            <Stack
                ref={cardRef}
                data-card
                direction="row"
                draggable={draggable}
                title={draggable ? t('rundown.entry.dragToReorder') : undefined}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={handleCardClick}
                sx={theme =>
                    rundownCardSx(theme, {
                        isDragging,
                        disabled,
                        cardClickable,
                        draggable,
                        locked,
                        supportsReorder,
                    })
                }
            >
                {supportsReorder && <RundownDragHandle visible={draggable} />}

                <Stack spacing={1.5} sx={{ flexGrow: 1, minWidth: 0 }}>
                    <RundownEntryTitleRow
                        title={title}
                        onPlay={onPlay}
                        onStop={onStop}
                        onDelete={onDelete}
                        disabled={disabled}
                    />
                    {children && (
                        <Stack spacing={1.5} direction="column">
                            {children}
                        </Stack>
                    )}
                </Stack>
            </Stack>

            <DropIndicatorGap
                open={dropIndicator === 'after'}
                height={gapHeight}
            />
        </Box>
    );
};
