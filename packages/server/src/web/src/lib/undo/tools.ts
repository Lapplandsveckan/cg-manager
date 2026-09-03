import { noTryAsync } from 'no-try';
import { type ManagerApi } from '../api/api';
import type { UndoEntry } from './types';
import { aliasId, liveId, rekeyScope } from './undoStore';

export class UndoStaleError extends Error {
    constructor() {
        super('Config has changed on the server since this action');
    }
}

export function omitId<T extends { id: string }>(obj: T): Omit<T, 'id'> {
    const { id: _id, ...rest } = obj;
    return rest;
}

export async function request(
    conn: ManagerApi,
    opts: { path: string; method: string; data: unknown },
): Promise<void> {
    await conn.rawRequest(opts.path, opts.method, opts.data);
}

export async function requestOk(
    conn: ManagerApi,
    path: string,
    method: string,
    data: unknown,
): Promise<boolean> {
    const [err] = await noTryAsync(() => conn.rawRequest(path, method, data));
    return !err;
}

/** @deprecated `rawRequest` now rejects on failure instead of resolving an
 *  error envelope, so this is a no-op identity cast on the success path —
 *  a failed request never reaches it. Prefer `await` + `.catch()`/
 *  `noTryAsync` directly. Kept only so already-built plugin bundles that
 *  reference it don't hard-crash; it does not restore old error handling. */
export function okData<T>(res: unknown): T | null {
    return (res as T) ?? null;
}

export function rekeyId(
    oldId: string,
    newId: string,
    scope: (id: string) => string,
    entry?: UndoEntry,
): void {
    const prevId = liveId(oldId);
    aliasId(prevId, newId);
    rekeyScope(scope(prevId), scope(newId));
    if (entry)
        entry.scopes = entry.scopes.map(s =>
            s === scope(prevId) ? scope(newId) : s,
        );
}

export const routeScope = (id: string): string => `route:${id}`;
export const rundownScope = (id: string, sub?: string): string =>
    sub ? `rundown:${id}:${sub}` : `rundown:${id}`;
export const CONFIG_SCOPE = 'config';
