import { type Theme } from '@mui/material';

interface RundownCardAppearanceInput {
    isDragging?: boolean;
    disabled?: boolean;
    cardClickable: boolean;
    draggable: boolean;
    locked?: boolean;
    supportsReorder: boolean;
    /** Plugin-set accent (`item.metadata.color`). Fills the drag-handle
     *  column as a solid background, narrower than the full left padding so
     *  a gap separates it from the text. */
    color?: string | null;
}

/** Colors the drag-handle column solid, rather than a thin bar next to it.
 *  Relies on the card's own `overflow: hidden` (set below) to clip its left
 *  corners to the card's rounded shape instead of rounding them itself,
 *  which is what produced a disconnected "pill" floating off the card edge. */
function accentGutterSx(
    color: string | null | undefined,
    isDragging: boolean | undefined,
    gutterWidth: number,
) {
    if (!color || isDragging) return undefined;

    return {
        content: '""',
        position: 'absolute' as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: gutterWidth,
        bgcolor: color,
    };
}

/** The card's full visual state — cursor, opacity, padding, hover/active
 *  colors — collapsed into one place so the component itself only has to
 *  describe *what* state it's in, not *how* that state looks. */
export function rundownCardSx(theme: Theme, input: RundownCardAppearanceInput) {
    const {
        isDragging,
        disabled,
        cardClickable,
        draggable,
        locked,
        supportsReorder,
        color,
    } = input;

    const cursor = draggable ? 'grab' : cardClickable ? 'pointer' : 'default';
    const opacity = isDragging ? 0 : disabled ? 0.55 : 1;
    // Reserve space so handle visibility toggle doesn't shift layout —
    // content position is unaffected by color. The accent gutter itself is
    // narrower than this padding, leaving a gap of plain card background
    // between the color and the text.
    const leftPadding = isDragging ? 0 : supportsReorder ? '28px' : 2;
    // Matches the drag handle's own bounds (left: 2, width: 20 — see
    // RundownDragHandle) rather than the full padding, so a gap of plain
    // card background separates the color from the text.
    const gutterWidth = supportsReorder ? 20 : 8;

    return {
        position: 'relative' as const,
        py: isDragging ? 0 : 2,
        pr: isDragging ? 0 : 2,
        pl: leftPadding,
        bgcolor: theme.palette.surface.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        width: '100%',
        cursor,
        opacity,
        maxHeight: isDragging ? 0 : 2000,
        // Always clipped to the card's rounded corners (not just while
        // dragging) so the accent gutter's square edge follows the card
        // shape instead of needing its own border-radius math.
        overflow: 'hidden' as const,
        transition: theme.transitions.create(
            ['border-color', 'background-color', 'opacity'],
            { duration: 180 },
        ),
        '&::before': accentGutterSx(color, isDragging, gutterWidth),
        '&:active': draggable ? { cursor: 'grabbing' } : undefined,
        '&:hover': cardClickable
            ? {
                  bgcolor: theme.palette.surface.elevated,
                  borderColor: locked
                      ? theme.palette.text.secondary
                      : (color ?? 'primary.main'),
              }
            : {
                  bgcolor: theme.palette.surface.elevated,
              },
    };
}
