import { useRouter } from 'next/router';
import { useTranslation } from 'react-i18next';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type {
    CommandItem,
    RunCommand,
} from '../../components/commandPalette/types';
import {
    NAV_ITEMS,
    usePluginNavItems,
    type NavItem,
} from '../../components/navbar/navItems';
import { useSocket } from '../hooks/useSocket';
import { queryClient } from '../query/client';
import { qk } from '../query/keys';
import { usePluginsQuery } from '../query/plugins';
import { useRundownList } from '../query/rundowns';

export const NAV_COMMAND = {
    rundown: 'nav.rundown',
    plugin: 'nav.plugin',
    mediaFolder: 'nav.mediaFolder',
};

const folderPath = (folder: string) => `${folder.replace(/\/+$/, '')}/`;

export function useNavigationCommands() {
    const { t } = useTranslation('common');
    const router = useRouter();
    const socket = useSocket();
    const pluginPages = usePluginNavItems();
    const { data: rundowns } = useRundownList();
    const { data: plugins } = usePluginsQuery();

    const go = (href: string) => () => router.push(href);

    const goToPage = (item: NavItem): RunCommand => {
        const Icon = item.icon;
        return {
            id: `nav.${item.href}`,
            label: t('commandPalette.commands.goTo', {
                page: t(item.labelKey),
            }),
            icon: <Icon fontSize="small" />,
            run: go(item.href),
        };
    };

    const itemCount = (count: number) =>
        count === 0
            ? t('playPage.itemCount.empty')
            : t('playPage.itemCount.count', { count });

    const rundownCommands = (): CommandItem[] =>
        (rundowns ?? []).map(rundown => ({
            id: `rundown.${rundown.id}`,
            label: rundown.name || t('playPage.unnamedRundown'),
            description: itemCount(rundown.items?.length ?? 0),
            run: go(`/play/${rundown.id}`),
        }));

    const pluginCommands = (): CommandItem[] =>
        (plugins ?? []).map(plugin => ({
            id: `plugin.${plugin.name}`,
            label: plugin.name,
            description: t(
                plugin.enabled
                    ? 'pluginsPage.status.active'
                    : 'pluginsPage.status.disabled',
            ),
            run: go(`/plugins/${encodeURIComponent(plugin.name)}`),
        }));

    const folderCommands = async (): Promise<CommandItem[]> => {
        const folders = await queryClient.ensureQueryData({
            queryKey: qk.mediaFolders,
            queryFn: () => socket.caspar.getFolders(),
        });
        const paths = ['', ...folders.map(folderPath)];

        return paths.map(path => ({
            id: `folder.${path}`,
            label: path || t('commandPalette.commands.mediaRoot'),
            run: () => router.push({ pathname: '/media', query: { path } }),
        }));
    };

    useRegisterCommands(
        () => [
            ...[...NAV_ITEMS, ...pluginPages].map(goToPage),
            {
                id: NAV_COMMAND.rundown,
                label: t('commandPalette.commands.openRundown'),
                placeholder: t(
                    'commandPalette.commands.openRundownPlaceholder',
                ),
                children: rundownCommands,
            },
            {
                id: NAV_COMMAND.plugin,
                label: t('commandPalette.commands.openPlugin'),
                children: pluginCommands,
            },
            {
                id: NAV_COMMAND.mediaFolder,
                label: t('commandPalette.commands.mediaFolder'),
                children: folderCommands,
            },
        ],
        { section: t('commandPalette.sections.navigation'), priority: 0 },
    );
}
