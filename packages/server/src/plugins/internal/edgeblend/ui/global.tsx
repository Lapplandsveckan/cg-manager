import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import {
    useBroadcast,
    useRegisterCommands,
    useSocket,
    type CommandItem,
} from '@web-lib';
import type { StoredLayout } from './LayoutEditor';
import { API_ROOT, layoutsUpdated } from './api';

const EdgeblendCommands: React.FC = () => {
    const { t } = useTranslation('common');
    const conn = useSocket();
    const [layouts, setLayouts] = useState<StoredLayout[]>([]);

    useEffect(() => {
        conn.rawRequest(`${API_ROOT}/layouts`, 'GET', {})
            .then((res: unknown) => setLayouts((res as StoredLayout[]) ?? []))
            .catch(() => setLayouts([]));
    }, [conn]);

    useBroadcast(layoutsUpdated, setLayouts);

    const toggle = (layout: StoredLayout) =>
        conn.rawRequest(`${API_ROOT}/layouts/${layout.id}`, 'UPDATE', {
            enabled: !layout.enabled,
        });

    const layoutCommands = (): CommandItem[] =>
        layouts.map(layout => ({
            id: `edgeblend.layout.${layout.id}`,
            label: layout.name,
            description: t(
                layout.enabled
                    ? 'plugins.edgeblend.commands.enabled'
                    : 'plugins.edgeblend.commands.disabled',
            ),
            run: () => toggle(layout),
        }));

    useRegisterCommands(
        () => [
            {
                id: 'edgeblend.toggle',
                label: t('plugins.edgeblend.commands.toggle'),
                icon: <ToggleOnRoundedIcon fontSize="small" />,
                disabled: layouts.length === 0,
                children: layoutCommands,
            },
        ],
        { section: t('plugins.edgeblend.commands.section') },
    );

    return null;
};

export default EdgeblendCommands;
