import { useEffect, useState } from 'react';
import { useSocket } from '../lib';
import { record, recordBarrier } from '../lib/undo/undoStore';
import { okData, request, requestOk, rundownScope } from '../lib/undo/tools';
import { useLatest } from '../lib/hooks/useLatest';

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
    const rundownsRef = useLatest(rundowns);

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
        const ok = await requestOk(
            conn,
            `/api/rundown/${entry.id}`,
            'UPDATE',
            entry.name,
        );
        if (!ok) return;

        const before = rundownsRef.current.find(v => v.id === entry.id);
        if (!before) return;

        setRundowns(prev =>
            prev.map(v => (v.id === entry.id ? { ...v, name: entry.name } : v)),
        );
        record({
            label: { key: 'rundownRename', params: { name: entry.name } },
            scopes: [rundownScope(entry.id, 'name')],
            prev: before.name,
            next: entry.name,
            apply: async (name, { api }) => {
                await request(api, {
                    path: `/api/rundown/${entry.id}`,
                    method: 'UPDATE',
                    data: name,
                });
                setRundowns(prev =>
                    prev.map(v => (v.id === entry.id ? { ...v, name } : v)),
                );
            },
        });
    };

    const deleteRundown = async (entry: Rundown) => {
        const ok = await requestOk(
            conn,
            `/api/rundown/${entry.id}`,
            'DELETE',
            null,
        );
        if (!ok) return;

        setRundowns(prev => prev.filter(v => v.id !== entry.id));
        recordBarrier({ key: 'rundownDelete', params: { name: entry.name } }, [
            rundownScope(entry.id),
        ]);
    };

    const createRundown = async (name: string): Promise<Rundown | null> => {
        const res = await conn.rawRequest('/api/rundown', 'CREATE', name);
        const data = okData<Rundown>(res);
        if (!data) return null;

        setRundowns(prev => [...prev, data]);
        recordBarrier({ key: 'rundownCreate', params: { name: data.name } }, [
            rundownScope(data.id),
        ]);
        return data;
    };

    return { rundowns, updateRundown, deleteRundown, createRundown };
}
