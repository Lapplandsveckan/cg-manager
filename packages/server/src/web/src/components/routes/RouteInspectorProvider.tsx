import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteModal } from './RouteModal';
import { DeleteRouteModal } from './DeleteRouteModal';
import { useRoutesQuery } from '../../lib/query/routes';
import { useChannelInfo } from '../../lib/query/caspar';
import { useRouteEditor } from '../../lib/hooks/useRouteEditor';
import { useToast } from '../ToastProvider';

interface RouteInspectorApi {
    /** Opens the route editor modal, pre-filled with the given route. Shows
     *  a toast instead of opening if the route isn't in the current routes
     *  list (still loading, or already deleted). */
    openRouteInspector: (routeId: string) => void;
    /** The shared edit/create/delete state — reused by the /routes page so
     *  there's only ever one RouteModal/DeleteRouteModal pair mounted. */
    editor: ReturnType<typeof useRouteEditor>;
}

const RouteInspectorContext = createContext<RouteInspectorApi | null>(null);

/** Lets any component — host or plugin — open the route editor modal on top
 *  of whatever page is currently mounted, without navigating to /routes. */
export const useRouteInspector = (): RouteInspectorApi => {
    const ctx = useContext(RouteInspectorContext);
    if (!ctx)
        throw new Error(
            'useRouteInspector must be used within a RouteInspectorProvider',
        );
    return ctx;
};

export const RouteInspectorProvider: React.FC<{
    children: React.ReactNode;
}> = ({ children }) => {
    const { t } = useTranslation('common');
    const notify = useToast();
    const { data: routes } = useRoutesQuery();
    const { channels, videoModes, channelSizes } = useChannelInfo();
    const editor = useRouteEditor();
    const { setEditing } = editor;

    const openRouteInspector = useCallback(
        (routeId: string) => {
            if (!routes) {
                notify(t('actions.loading'), 'info');
                return;
            }

            const route = routes.find(r => r.id === routeId);
            if (!route) {
                notify(t('videoRoutes.errors.routeNotFound'), 'error');
                return;
            }

            setEditing(route);
        },
        [routes, setEditing, notify, t],
    );

    const value = useMemo(
        () => ({ openRouteInspector, editor }),
        [openRouteInspector, editor],
    );

    return (
        <RouteInspectorContext.Provider value={value}>
            {children}
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
        </RouteInspectorContext.Provider>
    );
};
