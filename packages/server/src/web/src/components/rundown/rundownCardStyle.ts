import { type Theme } from '@mui/material';

interface RundownCardAppearanceInput {
    isDragging?: boolean;
    disabled?: boolean;
    cardClickable: boolean;
    draggable: boolean;
    locked?: boolean;
    supportsReorder: boolean;
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
    } = input;

    const cursor = draggable ? 'grab' : cardClickable ? 'pointer' : 'default';
    const opacity = isDragging ? 0 : disabled ? 0.55 : 1;
    // Reserve space so handle visibility toggle doesn't shift layout.
    const leftPadding = isDragging ? 0 : supportsReorder ? '28px' : 2;

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
        overflow: isDragging ? ('hidden' as const) : ('visible' as const),
        transition: theme.transitions.create(
            ['border-color', 'background-color', 'opacity'],
            { duration: 180 },
        ),
        '&:active': draggable ? { cursor: 'grabbing' } : undefined,
        '&:hover': cardClickable
            ? {
                  bgcolor: theme.palette.surface.elevated,
                  borderColor: locked
                      ? theme.palette.text.secondary
                      : 'primary.main',
              }
            : {
                  bgcolor: theme.palette.surface.elevated,
              },
    };
}
