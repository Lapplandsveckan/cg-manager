import { useEffect, useState } from 'react';
import { noTryAsync } from 'no-try';
import { useSocket } from '../lib';
import { assertOk } from '../lib/api/caspar';

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
    /** Read straight off the rundown's file on disk — not user-editable. */
    createdAt?: number;
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

    const updateRundown = async (entry: Rundown) => {
        const res = await conn.rawRequest(
            `/api/rundown/${entry.id}`,
            'UPDATE',
            entry.name,
        );

        const [err] = await noTryAsync(async () => assertOk(res));
        if (err) return;

        setRundowns(prev =>
            prev.map(v => (v.id === entry.id ? { ...v, name: entry.name } : v)),
        );
    };

    const deleteRundown = async (entry: Rundown) => {
        const res = await conn.rawRequest(
            `/api/rundown/${entry.id}`,
            'DELETE',
            null,
        );

        const [err] = await noTryAsync(async () => assertOk(res));
        if (err) return;

        setRundowns(prev => prev.filter(v => v.id !== entry.id));
    };

    const createRundown = async (name: string): Promise<Rundown | null> => {
        const res = await conn.rawRequest('/api/rundown', 'CREATE', name);

        const [err] = await noTryAsync(async () => assertOk(res));
        if (err || !res.data) return null;
        
        setRundowns(prev => [...prev, res.data]);
        return res.data;
    }

    return { rundowns, updateRundown, deleteRundown, createRundown };
}
