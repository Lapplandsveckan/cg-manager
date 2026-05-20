import React from 'react';
import {Box, Button, IconButton, Stack, Tooltip} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

interface RundownEditorActionBarProps {
    /** Primary action — saves the edit. Always present. */
    onSave: () => void;
    /** Dismiss the editor without saving or deleting. */
    onCancel?: () => void;
    /** Destructive action — usually wired up to a confirmation step. */
    onDelete?: () => void;

    /**
     * @deprecated Legacy contract kept so existing plugins keep working.
     * When provided: `exists=true` shows the delete icon and a Cancel button
     * (Cancel falls back to `onDelete` only if `onCancel` isn't supplied,
     * matching the previous behaviour of "the left button doubled as cancel
     * while creating"). `exists=false` means we're in create mode — Cancel is
     * shown (handler from `onCancel` or `onDelete`), no destructive action.
     * Prefer omitting `exists` and passing `onCancel` + optional `onDelete`.
     */
    exists?: boolean;
}

export const RundownEditorActionBar: React.FC<RundownEditorActionBarProps> = ({
    onSave,
    onCancel,
    onDelete,
    exists,
}) => {
    const legacyMode = exists !== undefined;
    const showDelete = legacyMode ? exists === true && Boolean(onDelete) : Boolean(onDelete);
    const cancelHandler = onCancel ?? (legacyMode && exists === false ? onDelete : undefined);

    return (
        <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            sx={{ width: '100%', mt: 2 }}
        >
            {showDelete ? (
                <Tooltip title="Delete">
                    <IconButton
                        size="small"
                        onClick={() => onDelete?.()}
                        sx={(theme) => ({
                            color: '#cf5b4a',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1,
                            '&:hover': {
                                bgcolor: 'rgba(207, 91, 74, 0.08)',
                                borderColor: '#cf5b4a',
                            },
                        })}
                    >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ) : <Box />}

            <Stack direction="row" gap={1}>
                {cancelHandler && (
                    <Button color="inherit" onClick={cancelHandler}>
                        Cancel
                    </Button>
                )}
                <Button variant="contained" onClick={onSave}>
                    Save
                </Button>
            </Stack>
        </Stack>
    );
};
