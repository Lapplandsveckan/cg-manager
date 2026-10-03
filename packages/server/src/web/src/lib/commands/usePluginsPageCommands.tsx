import { useTranslation } from 'react-i18next';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { CommandItem } from '../../components/commandPalette/types';
import type { Plugin } from '../api/plugin';

interface PluginsPageCommandsArgs {
    plugins: Plugin[];
    toggle: (name: string, enabled: boolean) => unknown;
    upload: () => unknown;
}

export function usePluginsPageCommands({
    plugins,
    toggle,
    upload,
}: PluginsPageCommandsArgs) {
    const { t } = useTranslation('common');
    const toEnable = plugins.filter(plugin => !plugin.enabled);
    const toDisable = plugins.filter(plugin => plugin.enabled);

    const toggleCommands =
        (candidates: Plugin[], next: boolean) => (): CommandItem[] =>
            candidates.map(plugin => ({
                id: `plugins.toggle.${plugin.name}`,
                label: plugin.name,
                run: () => toggle(plugin.name, next),
            }));

    useRegisterCommands(
        () => [
            {
                id: 'plugins.enable',
                label: t('commandPalette.commands.enablePlugin'),
                icon: <PowerSettingsNewRoundedIcon fontSize="small" />,
                disabled: toEnable.length === 0,
                children: toggleCommands(toEnable, true),
            },
            {
                id: 'plugins.disable',
                label: t('commandPalette.commands.disablePlugin'),
                icon: <ToggleOffRoundedIcon fontSize="small" />,
                disabled: toDisable.length === 0,
                children: toggleCommands(toDisable, false),
            },
            {
                id: 'plugins.upload',
                label: t('commandPalette.commands.uploadPlugin'),
                icon: <CloudUploadRoundedIcon fontSize="small" />,
                run: upload,
            },
        ],
        { section: t('commandPalette.sections.plugins'), priority: 100 },
    );
}
