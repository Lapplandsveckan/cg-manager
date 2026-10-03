import { useTranslation } from 'react-i18next';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PowerSettingsNewRoundedIcon from '@mui/icons-material/PowerSettingsNewRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useRegisterCommands, type CommandItem } from '@web-lib';
import type { VideoRoute } from './api';
import type { SourceType } from './components/RouteSourceTypePicker';
import { useRouteToggle } from './hooks/useRouteToggle';

const SOURCE_TYPES: SourceType[] = ['decklink', 'video', 'channel', 'color'];

interface RouteCommandsArgs {
    routes: VideoRoute[];
    edit: (route: VideoRoute) => void;
    remove: (route: VideoRoute) => void;
    create: (type: SourceType) => void;
}

export function useRouteCommands({
    routes,
    edit,
    remove,
    create,
}: RouteCommandsArgs) {
    const { t } = useTranslation('routes');
    const toggle = useRouteToggle();

    const routeName = (route: VideoRoute) => route.name || t('unnamed');

    const routeCommands =
        (
            run: (route: VideoRoute) => unknown,
            describe?: (route: VideoRoute) => string,
            danger?: boolean,
        ) =>
        (): CommandItem[] =>
            routes.map(route => ({
                id: `routes.route.${route.id}`,
                label: routeName(route),
                description: describe?.(route),
                danger,
                run: () => run(route),
            }));

    const sourceTypeCommands = (): CommandItem[] =>
        SOURCE_TYPES.map(type => ({
            id: `routes.type.${type}`,
            label: t(`sourceTypes.${type}`),
            description: t(`sourceTypeDescriptions.${type}`),
            run: () => create(type),
        }));

    const stateOf = (route: VideoRoute) =>
        t(route.enabled ? 'commands.enabled' : 'commands.disabled');

    useRegisterCommands(
        () => [
            {
                id: 'routes.toggle',
                label: t('commands.toggle'),
                icon: <PowerSettingsNewRoundedIcon fontSize="small" />,
                disabled: routes.length === 0,
                children: routeCommands(
                    route => toggle(route.id, !route.enabled),
                    stateOf,
                ),
            },
            {
                id: 'routes.edit',
                label: t('commands.edit'),
                icon: <EditOutlinedIcon fontSize="small" />,
                disabled: routes.length === 0,
                children: routeCommands(edit, stateOf),
            },
            {
                id: 'routes.create',
                label: t('commands.create'),
                icon: <AddRoundedIcon fontSize="small" />,
                children: sourceTypeCommands,
            },
            {
                id: 'routes.delete',
                label: t('commands.delete'),
                icon: <DeleteOutlineRoundedIcon fontSize="small" />,
                danger: true,
                disabled: routes.length === 0,
                children: routeCommands(remove, stateOf, true),
            },
        ],
        { section: t('nav') },
    );
}
