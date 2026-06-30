import React from 'react';
import {
    Box,
    Stack,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    alpha,
} from '@mui/material';
import { keyframes } from '@mui/system';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useTranslation } from 'next-i18next';

const LIVE_RED = '#e0463a';

const livePulse = keyframes`
    0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 ${alpha(LIVE_RED, 0.6)}; }
    50% { transform: scale(1.15); opacity: 0.85; box-shadow: 0 0 0 6px ${alpha(LIVE_RED, 0)}; }
`;

/** Shown when the rundown is unlocked — items will fire on card click. */
export const LiveIndicator: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                bgcolor: alpha(LIVE_RED, 0.14),
                border: `1px solid ${alpha(LIVE_RED, 0.45)}`,
                color: LIVE_RED,
            }}
        >
            <Box
                sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: LIVE_RED,
                    animation: `${livePulse} 1.4s ease-in-out infinite`,
                }}
            />
            <Typography
                variant="caption"
                sx={{
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    fontSize: '0.7rem',
                }}
            >
                {t('rundown.indicator.live')}
            </Typography>
        </Stack>
    );
};

/** Shown when the rundown is locked — items only fire from the play button. */
export const EditIndicator: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <Stack
            direction="row"
            alignItems="center"
            gap={0.75}
            sx={theme => ({
                px: 1.25,
                py: 0.5,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                color: theme.palette.primary.main,
            })}
        >
            <EditOutlinedIcon sx={{ fontSize: 14 }} />
            <Typography
                variant="caption"
                sx={{
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    fontSize: '0.7rem',
                }}
            >
                {t('rundown.indicator.edit')}
            </Typography>
        </Stack>
    );
};

interface ModeToggleProps {
    locked: boolean;
    onChange: (locked: boolean) => void;
}

/** Segmented Edit | Live toggle — clearly shows both modes and which is active. */
export const ModeToggle: React.FC<ModeToggleProps> = ({ locked, onChange }) => {
    const { t } = useTranslation('common');
    return (
        <ToggleButtonGroup
            exclusive
            value={locked ? 'edit' : 'live'}
            onChange={(_, val: string | null) => {
                if (val !== null) onChange(val === 'edit');
            }}
            size="small"
            sx={theme => ({
                '& .MuiToggleButton-root': {
                    px: 1.25,
                    py: 0.5,
                    gap: 0.75,
                    textTransform: 'none',
                    color: 'text.secondary',
                    borderColor: theme.palette.divider,
                },
            })}
        >
            <ToggleButton
                value="edit"
                sx={theme => ({
                    '&.Mui-selected': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.22),
                        },
                    },
                    '&:not(.Mui-selected):hover': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                    },
                })}
            >
                <Tooltip
                    title={t('rundown.modeToggle.editTooltip')}
                    placement="bottom"
                >
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <EditOutlinedIcon sx={{ fontSize: 14 }} />
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                            }}
                        >
                            {t('rundown.indicator.edit')}
                        </Typography>
                    </Stack>
                </Tooltip>
            </ToggleButton>
            <ToggleButton
                value="live"
                sx={{
                    '&.Mui-selected': {
                        color: LIVE_RED,
                        bgcolor: alpha(LIVE_RED, 0.14),
                        '&:hover': {
                            bgcolor: alpha(LIVE_RED, 0.22),
                        },
                    },
                    '&:not(.Mui-selected):hover': {
                        color: LIVE_RED,
                        bgcolor: alpha(LIVE_RED, 0.08),
                    },
                }}
            >
                <Tooltip
                    title={t('rundown.modeToggle.liveTooltip')}
                    placement="bottom"
                >
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                            }}
                        >
                            {t('rundown.indicator.live')}
                        </Typography>
                    </Stack>
                </Tooltip>
            </ToggleButton>
        </ToggleButtonGroup>
    );
};
