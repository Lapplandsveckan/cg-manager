import React from 'react';
import {
    Card,
    IconButton,
    Stack,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from 'next-i18next';
import { useContextMenu } from '../../../ContextMenuProvider';

interface FixtureRowProps {
    label: string;
    selected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}

export const FixtureRow: React.FC<FixtureRowProps> = ({
    label,
    selected,
    onSelect,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const { openMenu } = useContextMenu();
    return (
        <Card
            variant="outlined"
            onClick={onSelect}
            onContextMenu={e =>
                openMenu(e, [
                    { label: t('actions.select'), onClick: onSelect },
                    {
                        label: t('actions.delete'),
                        icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                        danger: true,
                        divider: true,
                        onClick: onDelete,
                    },
                ])
            }
            sx={theme => ({
                p: 1,
                cursor: 'pointer',
                bgcolor: selected
                    ? alpha(theme.palette.primary.main, 0.15)
                    : theme.palette.surface.elevated,
                borderColor: selected
                    ? theme.palette.primary.main
                    : theme.palette.divider,
            })}
        >
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                gap={1}
            >
                <Typography
                    variant="body2"
                    sx={{
                        fontFamily: 'monospace',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {label}
                </Typography>
                <Tooltip title={t('actions.delete')}>
                    <IconButton
                        size="small"
                        onClick={e => {
                            e.stopPropagation();
                            onDelete();
                        }}
                    >
                        <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Card>
    );
};
