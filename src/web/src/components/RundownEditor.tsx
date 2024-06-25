import React from 'react';
import {Button, Stack} from '@mui/material';

interface RundownEditorActionBarProps {
    exists: boolean;

    onDelete: () => void;
    onSave: () => void;
}

export const RundownEditorActionBar = ({ exists, onDelete, onSave }) => {
    return (
        <Stack
            spacing={2}
            direction="row"
            sx={{
                justifyContent: 'space-between',
                width: '100%',
            }}
        >
            <Button
                color="error"
                onClick={() => onDelete()}

                sx={{
                    flex: 1,
                }}
            >
                {exists ? 'Delete' : 'Cancel'}
            </Button>
            <Button
                onClick={() => onSave()}

                sx={{
                    flex: 1,
                }}
            >
                Save
            </Button>
        </Stack>
    );
};