import { Method } from 'rest-exchange-protocol-client';
import { type CasparConfig, type CasparStatus, type MediaDoc } from './caspar';
import { type Plugin } from './plugin';
import { type Rundown, type RundownItem } from './rundowns';
import { type VideoRoute } from './videoRoutes';

/** One entry per server broadcast topic: path, method and the payload shape,
 *  declared once so subscribers never re-cast `unknown` by hand. Lives next
 *  to `BroadcastDispatcher` (not `lib/query/`) because topics reference
 *  `caspar`/`plugin`/`rundowns`/`videoRoutes` API types — putting it under
 *  `lib/query/` would make those files depend back on `lib/api/`. */
export interface BroadcastTopic<T> {
    path: string;
    method: Method;
    isValid: (data: unknown) => data is T;
}

export function topic<T>(
    path: string,
    method: Method,
    isValid: (data: unknown) => data is T,
): BroadcastTopic<T> {
    return { path, method, isValid };
}

const fields = (data: unknown) => (data ?? {}) as Record<string, unknown>;
const isString = (value: unknown): value is string => typeof value === 'string';
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const hasId = (value: unknown): boolean => isString(fields(value).id);

export const rundownCreated = topic<Rundown>(
    'rundown',
    Method.CREATE,
    (data): data is Rundown => hasId(data),
);

export const rundownRenamed = topic<{ id: string; name: string }>(
    'rundown',
    Method.UPDATE,
    (data): data is { id: string; name: string } =>
        isString(fields(data).id) && isString(fields(data).name),
);

export const rundownDeleted = topic<string>('rundown', Method.DELETE, isString);

export const entryCreated = topic<{
    id: string;
    entry: RundownItem;
    index?: number;
}>(
    'rundown/entry',
    Method.CREATE,
    (
        data,
    ): data is {
        id: string;
        entry: RundownItem;
        index?: number;
    } => isString(fields(data).id) && hasId(fields(data).entry),
);

export const entryUpdated = topic<{
    id: string;
    entry: RundownItem | RundownItem[];
}>(
    'rundown/entry',
    Method.UPDATE,
    (
        data,
    ): data is {
        id: string;
        entry: RundownItem | RundownItem[];
    } => {
        const entry = fields(data).entry;
        const entries = Array.isArray(entry) ? entry : [entry];
        return isString(fields(data).id) && entries.every(hasId);
    },
);

export const entryDeleted = topic<{ id: string; entry: string }>(
    'rundown/entry',
    Method.DELETE,
    (data): data is { id: string; entry: string } =>
        isString(fields(data).id) && isString(fields(data).entry),
);

export const entriesReordered = topic<{ id: string; order: string[] }>(
    'rundown/order',
    Method.ACTION,
    (data): data is { id: string; order: string[] } =>
        isString(fields(data).id) && Array.isArray(fields(data).order),
);

export const routeCreated = topic<VideoRoute>(
    'routes',
    Method.CREATE,
    (data): data is VideoRoute => hasId(data),
);

export const routeUpdated = topic<VideoRoute>(
    'routes',
    Method.UPDATE,
    (data): data is VideoRoute => hasId(data),
);

export const routeDeleted = topic<string>('routes', Method.DELETE, isString);

export const casparStatus = topic<CasparStatus>(
    'caspar/status',
    Method.ACTION,
    (data): data is CasparStatus => isRecord(data),
);

export const casparRunningConfig = topic<CasparConfig | null>(
    'caspar/running-config',
    Method.ACTION,
    (data): data is CasparConfig | null => data === null || isRecord(data),
);

export const casparConfig = topic<CasparConfig>(
    'caspar/config',
    Method.UPDATE,
    (data): data is CasparConfig => isRecord(data),
);

export const mediaChanged = topic<{ key: string; value: MediaDoc | null }>(
    'caspar/media',
    Method.ACTION,
    (data): data is { key: string; value: MediaDoc | null } =>
        isString(fields(data).key),
);

export const mediaFolders = topic<string[]>(
    'caspar/media/folder',
    Method.ACTION,
    (data): data is string[] => Array.isArray(data),
);

export const pluginsChanged = topic<Plugin[]>(
    'plugins',
    Method.ACTION,
    (data): data is Plugin[] => Array.isArray(data),
);

export const casparLogs = topic<string>('caspar/logs', Method.ACTION, isString);
