import { useTranslation } from 'react-i18next';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';

interface ServerCommandsArgs {
    hasLogs: boolean;
    clearLogs: () => void;
}

export function useServerCommands({ hasLogs, clearLogs }: ServerCommandsArgs) {
    const { t } = useTranslation('common');

    useRegisterCommands(
        () => [
            {
                id: 'server.clearLogs',
                label: t('commandPalette.commands.clearLogs'),
                icon: <DeleteSweepRoundedIcon fontSize="small" />,
                disabled: !hasLogs,
                run: clearLogs,
            },
        ],
        { section: t('commandPalette.sections.server'), priority: 100 },
    );
}
