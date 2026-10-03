import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { CommandItem } from '../../components/commandPalette/types';
import { logout } from '../../components/navbar/logout';
import { useUndo } from '../../components/UndoProvider';
import { SUPPORTED_LANGUAGES, applyLanguage } from '../detectLanguage';
import { useCasparActions } from '../hooks/useCasparActions';
import { useAuthQuery } from '../query/auth';
import { useRundownMutations } from '../query/rundowns';

export function useAppCommands() {
    const { t, i18n } = useTranslation('common');
    const router = useRouter();
    const { undo, redo, canUndo, canRedo, isBusy } = useUndo();
    const { createRundown } = useRundownMutations('rundown');
    const { data: auth } = useAuthQuery();
    const caspar = useCasparActions();

    const createAndOpen = async (name: string) => {
        const created = await createRundown(name);
        if (created) router.push(`/play/${created.id}`);
    };

    const languageCommands = (): CommandItem[] =>
        SUPPORTED_LANGUAGES.map(lng => ({
            id: `app.language.${lng}`,
            label: t(`language.${lng}`),
            disabled:
                lng === i18n.language
                    ? t('commandPalette.commands.currentLanguage')
                    : false,
            run: () => applyLanguage(lng),
        }));

    useRegisterCommands(
        () => [
            {
                id: 'app.undo',
                label: t('commandPalette.commands.undo'),
                icon: <UndoRoundedIcon fontSize="small" />,
                disabled: !canUndo || isBusy,
                run: undo,
            },
            {
                id: 'app.redo',
                label: t('commandPalette.commands.redo'),
                icon: <RedoRoundedIcon fontSize="small" />,
                disabled: !canRedo || isBusy,
                run: redo,
            },
            {
                id: 'app.newRundown',
                label: t('commandPalette.commands.newRundown'),
                icon: <AddRoundedIcon fontSize="small" />,
                prompt: {
                    placeholder: t(
                        'commandPalette.commands.newRundownPlaceholder',
                    ),
                    submitLabel: value =>
                        t('commandPalette.commands.createNamed', { value }),
                    submit: createAndOpen,
                },
            },
            {
                id: 'app.language',
                label: t('commandPalette.commands.language'),
                icon: <LanguageRoundedIcon fontSize="small" />,
                children: languageCommands,
            },
            auth?.enabled && {
                id: 'app.logout',
                label: t('auth.signOut'),
                icon: <LogoutRoundedIcon fontSize="small" />,
                run: logout,
            },
        ],
        { section: t('commandPalette.sections.general'), priority: 0 },
    );

    useRegisterCommands(
        () => [
            {
                id: 'caspar.start',
                label: t('commandPalette.commands.caspar.start'),
                icon: <PlayArrowRoundedIcon fontSize="small" />,
                disabled: !caspar.can.start,
                run: () => caspar.run('start'),
            },
            {
                id: 'caspar.stop',
                label: t('commandPalette.commands.caspar.stop'),
                icon: <StopRoundedIcon fontSize="small" />,
                disabled: !caspar.can.stop,
                run: () => caspar.run('stop'),
            },
            {
                id: 'caspar.restart',
                label: t('commandPalette.commands.caspar.restart'),
                icon: <RestartAltRoundedIcon fontSize="small" />,
                disabled: !caspar.can.restart,
                run: () => caspar.run('restart'),
            },
        ],
        { section: t('commandPalette.sections.server'), priority: 0 },
    );
}
