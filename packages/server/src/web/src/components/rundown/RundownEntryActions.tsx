import React from 'react';
import { IconButton, Stack, Tooltip, alpha } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from 'react-i18next';

interface ActionIconButtonProps {
    icon: React.ReactNode;
    tooltip: string;
    color: string;
    onClick?: () => void;
    sx?: SxProps<Theme>;
}

const ActionIconButton: React.FC<ActionIconButtonProps> = ({
    icon,
    tooltip,
    color,
    onClick,
    sx,
}) => (
    <Tooltip title={tooltip}>
        {/* Array form, not a spread — `sx` may be a theme callback, and
            spreading a function into an object silently drops every style. */}
        <IconButton
            size="small"
            onClick={onClick}
            sx={[{ color }, ...(Array.isArray(sx) ? sx : [sx])]}
        >
            {icon}
        </IconButton>
    </Tooltip>
);

interface RundownEntryActionsProps {
    onPlay: () => void;
    onStop?: () => void;
    /** Only relevant when `disabled` is true; the button is hidden otherwise. */
    onDelete?: () => void;
    /** Dimmed presentation — the item's action type isn't registered on the
     *  server (typically because the owning plugin is disabled). Play/stop
     *  are replaced by a delete button so the user can clean up the stale item. */
    disabled?: boolean;
}

export const RundownEntryActions: React.FC<RundownEntryActionsProps> = ({
    onPlay,
    onStop,
    onDelete,
    disabled,
}) => {
    const { t } = useTranslation('common');

    if (disabled)
        return (
            <Stack direction="row" alignItems="center" gap={0.5}>
                <ActionIconButton
                    icon={<DeleteOutlineRoundedIcon fontSize="small" />}
                    tooltip={t('rundown.entry.orphanedTooltip')}
                    color="error.main"
                    onClick={onDelete}
                    sx={theme => ({
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        '&:hover': {
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                            borderColor: theme.palette.error.main,
                        },
                    })}
                />
            </Stack>
        );

    return (
        <Stack direction="row" alignItems="center" gap={0.5}>
            {onStop && (
                <ActionIconButton
                    icon={<StopRoundedIcon fontSize="small" />}
                    tooltip={t('actions.stop')}
                    color="error.main"
                    onClick={onStop}
                />
            )}
            <ActionIconButton
                icon={<PlayArrowRoundedIcon fontSize="small" />}
                tooltip={t('actions.play')}
                color="primary.main"
                onClick={onPlay}
            />
        </Stack>
    );
};
