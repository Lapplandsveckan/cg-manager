import { useEffect, useState } from 'react';
import { useSocket } from '../lib';

export interface RundownItem {
    id: string;
    title: string;
    type: string;
    data: unknown;
    metadata?: { autoNext?: boolean };
}

export interface Rundown {
    id: string;
    name: string;
    items: RundownItem[];
    type?: 'rundown' | 'quick';
}

export function useRundowns() {
    const conn = useSocket();
    const [rundowns, setRundowns] = useState<Rundown[]>([]);

    useEffect(() => {
        conn.rawRequest('/api/rundown', 'GET', {}).then(res =>
            setRundowns(res.data ?? []),
        );

        const updateListener = {
            path: 'rundown',
            method: 'UPDATE',
            handler: request =>
                setRundowns(prev =>
                    prev.map(v =>
                        v.id === request.getData().id
                            ? { ...v, name: request.getData().name }
                            : v,
                    ),
                ),
        };

        const deleteListener = {
            path: 'rundown',
            method: 'DELETE',
            handler: request =>
                setRundowns(prev =>
                    prev.filter(v => v.id !== request.getData()),
                ),
        };

        const createListener = {
            path: 'rundown',
            method: 'CREATE',
            handler: request =>
                request.getData().type !== 'quick' &&
                setRundowns(prev => [...prev, request.getData()]),
        };

        conn.routes.register(updateListener);
        conn.routes.register(deleteListener);
        conn.routes.register(createListener);

        return () => {
            conn.routes.unregister(updateListener);
            conn.routes.unregister(deleteListener);
            conn.routes.unregister(createListener);
        };
    }, []);

    const updateRundown = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'UPDATE', entry.name);
        setRundowns(prev =>
            prev.map(v => (v.id === entry.id ? { ...v, name: entry.name } : v)),
        );
    };

    const deleteRundown = (entry: Rundown) => {
        conn.rawRequest(`/api/rundown/${entry.id}`, 'DELETE', null);
        setRundowns(prev => prev.filter(v => v.id !== entry.id));
    };

    const createRundown = (name: string) => {
        return conn
            .rawRequest('/api/rundown', 'CREATE', name)
            .then(({ data }) => {
                setRundowns(prev => [...prev, data]);
                return data as Rundown;
            });
    };

    return { rundowns, updateRundown, deleteRundown, createRundown };
}
