import { type IngestApi, type IngestSessionHandler } from './types/ingest';

export interface PluginIngest {
    api: IngestApi;
    unregister(): void;
}

/** Per-plugin view of the host's ingest manager. Identical behaviour, except
 *  session handlers are tracked so a disabled plugin stops hearing about
 *  sessions. Delegation is written out rather than spread, because the host's
 *  implementation is a class and its methods live on the prototype. */
export function pluginIngestApi(ingest: IngestApi): PluginIngest {
    const handlers: IngestSessionHandler[] = [];

    const api: IngestApi = {
        listShares: () => ingest.listShares(),
        listSharesWithPath: () => ingest.listSharesWithPath(),
        getShare: id => ingest.getShare(id),
        createShare: data => ingest.createShare(data),
        revokeShare: id => ingest.revokeShare(id),
        sharePath: id => ingest.sharePath(id),

        listSessions: () => ingest.listSessions(),
        getSession: id => ingest.getSession(id),
        closeSession: id => ingest.closeSession(id),
        prepare: (sessionId, casparChannel) =>
            ingest.prepare(sessionId, casparChannel),
        release: sessionId => ingest.release(sessionId),

        onSession: handler => {
            handlers.push(handler);

            return ingest.onSession(handler);
        },
        offSession: handler => {
            const index = handlers.indexOf(handler);
            if (index >= 0) handlers.splice(index, 1);

            ingest.offSession(handler);
        },
    };

    return {
        api,
        unregister: () => {
            for (const handler of handlers) ingest.offSession(handler);
            handlers.length = 0;
        },
    };
}
