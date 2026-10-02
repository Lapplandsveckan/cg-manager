import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBroadcast, useChannelInfo, useToast } from '@web-lib';
import { RouteModal } from './components/RouteModal';
import { DeleteRouteModal } from './components/DeleteRouteModal';
import { INSPECT_EVENT, type InspectRequest } from './inspectorEvents';
import {
    routeDeleted,
    routeUpdated,
    useRoutesQuery,
    useRoutesSync,
} from './query';
import { routeUndo, routeKey } from './undo';
import { useRouteEditor } from './useRouteEditor';

const GlobalRouteInspector: React.FC = () => {
    const { t } = useTranslation('common');
    const notify = useToast();
    const { data: routes } = useRoutesQuery();
    const { channels, videoModes, channelSizes } = useChannelInfo();
    const editor = useRouteEditor();
    const { setEditing, setDeleting, setNewType } = editor;

    useRoutesSync();
    useBroadcast(routeUpdated, ({ id }) =>
        routeUndo.invalidate([routeKey(id)]),
    );
    useBroadcast(routeDeleted, id => routeUndo.invalidate([routeKey(id)]));

    useEffect(() => {
        const onInspect = (event: Event) => {
            const request = (event as CustomEvent<InspectRequest>).detail;
            if ('create' in request) return setNewType(request.create);

            const id = 'edit' in request ? request.edit : request.delete;
            const route = routes?.find(r => r.id === id);
            if (!routes) return notify(t('actions.loading'), 'info');
            if (!route)
                return notify(t('videoRoutes.errors.routeNotFound'), 'error');

            if ('edit' in request) return setEditing(route);
            setDeleting(route);
        };

        window.addEventListener(INSPECT_EVENT, onInspect);
        return () => window.removeEventListener(INSPECT_EVENT, onInspect);
    }, [routes, setEditing, setDeleting, setNewType, notify, t]);

    return (
        <>
            <RouteModal
                open={editor.modalOpen}
                route={editor.editing}
                newType={editor.newType ?? undefined}
                channels={channels}
                videoModes={videoModes}
                channelSizes={channelSizes}
                onClose={editor.closeModal}
                onSave={editor.saveRoute}
                onDelete={
                    editor.editing
                        ? () => editor.setDeleting(editor.editing)
                        : undefined
                }
            />
            <DeleteRouteModal
                deleting={editor.deleting}
                busy={editor.deleteBusy}
                onClose={() => editor.setDeleting(null)}
                onConfirm={editor.confirmDelete}
            />
        </>
    );
};

export default GlobalRouteInspector;
