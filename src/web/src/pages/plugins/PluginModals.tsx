import { Button, Card, Modal, Stack, Typography } from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTranslation } from 'next-i18next';

interface ChannelInfo {
    name: string;
    need: number;
    have: number;
}

export interface PluginModalsProps {
    enableWarning: ChannelInfo | null;
    onEnableWarningClose: () => void;
    onForceEnable: (name: string) => void;
    channelPrompt: ChannelInfo | null;
    onChannelPromptClose: () => void;
    addingChannels: boolean;
    onAddChannels: (need: number) => void;
    showRestartPrompt: boolean;
    onRestartPromptClose: () => void;
    restarting: boolean;
    onRestart: () => void;
    uninstalling: string | null;
    onUninstallClose: () => void;
    onConfirmUninstall: () => void;
}

const centeredModal = {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
};

const cardSx =
    (width: number) =>
    (theme: {
        palette: { surface: { elevated: string }; divider: string };
    }) => ({
        p: 3,
        width,
        bgcolor: theme.palette.surface.elevated,
        border: `1px solid ${theme.palette.divider}`,
    });

export const PluginModals: React.FC<PluginModalsProps> = ({
    enableWarning,
    onEnableWarningClose,
    onForceEnable,
    channelPrompt,
    onChannelPromptClose,
    addingChannels,
    onAddChannels,
    showRestartPrompt,
    onRestartPromptClose,
    restarting,
    onRestart,
    uninstalling,
    onUninstallClose,
    onConfirmUninstall,
}) => {
    const { t } = useTranslation('common');
    return (
        <>
            <Modal open={Boolean(enableWarning)} onClose={onEnableWarningClose}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={centeredModal}
                >
                    <Card sx={cardSx(480)}>
                        <Stack spacing={2}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                            >
                                <WarningAmberRoundedIcon
                                    sx={{ color: 'warning.main' }}
                                />
                                <Typography variant="h3">
                                    {t(
                                        'pluginsPage.channels.enableWarning.title',
                                    )}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('pluginsPage.channels.enableWarning.body', {
                                    name: enableWarning?.name,
                                    need: enableWarning?.need,
                                    have: enableWarning?.have,
                                })}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={onEnableWarningClose}
                                >
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="warning"
                                    onClick={() =>
                                        onForceEnable(enableWarning!.name)
                                    }
                                >
                                    {t(
                                        'pluginsPage.channels.enableWarning.confirm',
                                    )}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            <Modal open={Boolean(channelPrompt)} onClose={onChannelPromptClose}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={centeredModal}
                >
                    <Card sx={cardSx(480)}>
                        <Stack spacing={2}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                            >
                                <WarningAmberRoundedIcon
                                    sx={{ color: 'warning.main' }}
                                />
                                <Typography variant="h3">
                                    {t('pluginsPage.channels.addPrompt.title')}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('pluginsPage.channels.addPrompt.body', {
                                    name: channelPrompt?.name,
                                    need: channelPrompt?.need,
                                    have: channelPrompt?.have,
                                    add:
                                        (channelPrompt?.need ?? 0) -
                                        (channelPrompt?.have ?? 0),
                                })}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={onChannelPromptClose}
                                >
                                    {t('pluginsPage.channels.addPrompt.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={addingChannels}
                                    onClick={() =>
                                        onAddChannels(channelPrompt!.need)
                                    }
                                >
                                    {t('pluginsPage.channels.addPrompt.add', {
                                        add:
                                            (channelPrompt?.need ?? 0) -
                                            (channelPrompt?.have ?? 0),
                                    })}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            <Modal open={showRestartPrompt} onClose={onRestartPromptClose}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={centeredModal}
                >
                    <Card sx={cardSx(460)}>
                        <Stack spacing={2}>
                            <Typography variant="h3">
                                {t('pluginsPage.channels.restartPrompt.title')}
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('pluginsPage.channels.restartPrompt.body')}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={onRestartPromptClose}
                                >
                                    {t(
                                        'pluginsPage.channels.restartPrompt.later',
                                    )}
                                </Button>
                                <Button
                                    variant="contained"
                                    disabled={restarting}
                                    onClick={onRestart}
                                >
                                    {restarting
                                        ? t('config.restarting')
                                        : t(
                                              'pluginsPage.channels.restartPrompt.restartNow',
                                          )}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>

            <Modal open={Boolean(uninstalling)} onClose={onUninstallClose}>
                <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={centeredModal}
                >
                    <Card sx={cardSx(460)}>
                        <Stack spacing={2}>
                            <Stack
                                direction="row"
                                alignItems="center"
                                gap={1.5}
                            >
                                <WarningAmberRoundedIcon
                                    sx={{ color: '#e88c8c' }}
                                />
                                <Typography variant="h3">
                                    {t('pluginsPage.uninstall.title')}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                sx={{ color: 'text.secondary' }}
                            >
                                {t('pluginsPage.uninstall.body', {
                                    name: uninstalling,
                                })}
                            </Typography>
                            <Stack
                                direction="row"
                                justifyContent="flex-end"
                                gap={1}
                            >
                                <Button
                                    color="inherit"
                                    onClick={onUninstallClose}
                                >
                                    {t('actions.cancel')}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={onConfirmUninstall}
                                >
                                    {t('pluginsPage.uninstall.confirm')}
                                </Button>
                            </Stack>
                        </Stack>
                    </Card>
                </Stack>
            </Modal>
        </>
    );
};
