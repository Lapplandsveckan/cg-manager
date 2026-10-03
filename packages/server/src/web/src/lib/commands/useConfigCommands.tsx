import { useTranslation } from 'react-i18next';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { ConfigMode } from '../config/useConfigMode';

interface ConfigCommandsArgs {
    loaded: boolean;
    dirty: boolean;
    saving: boolean;
    mode: ConfigMode;
    setMode: (mode: ConfigMode) => void;
    save: () => unknown;
    discard: () => unknown;
    addChannel: () => unknown;
}

export function useConfigCommands({
    loaded,
    dirty,
    saving,
    mode,
    setMode,
    save,
    discard,
    addChannel,
}: ConfigCommandsArgs) {
    const { t } = useTranslation('common');
    const nextMode = mode === 'simple' ? 'advanced' : 'simple';

    useRegisterCommands(
        () => [
            dirty && {
                id: 'config.save',
                label: t('commandPalette.commands.saveConfig'),
                icon: <SaveRoundedIcon fontSize="small" />,
                disabled: saving,
                run: save,
            },
            dirty && {
                id: 'config.discard',
                label: t('commandPalette.commands.discardConfig'),
                icon: <UndoRoundedIcon fontSize="small" />,
                disabled: saving,
                danger: true,
                run: discard,
            },
            {
                id: 'config.mode',
                label: t(`commandPalette.commands.configMode.${nextMode}`),
                icon: <TuneRoundedIcon fontSize="small" />,
                run: () => setMode(nextMode),
            },
            loaded && {
                id: 'config.addChannel',
                label: t('commandPalette.commands.addChannel'),
                icon: <AddRoundedIcon fontSize="small" />,
                run: addChannel,
            },
        ],
        { section: t('commandPalette.sections.config'), priority: 100 },
    );
}
