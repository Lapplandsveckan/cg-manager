import { useEffect } from 'react';
import { noTry } from 'no-try';
import { type ManagerApi } from '../api/api';
import { useLatest } from '../hooks/useLatest';
import { reportClientError } from '../reportClientError';

type BroadcastHandler = (data: unknown) => void;

interface Topic {
    route: {
        path: string;
        method: string;
        handler: (request: { getData: () => unknown }) => void;
    };
    handlers: Set<BroadcastHandler>;
}

/** REP dispatches an incoming message to the FIRST registered route whose
 *  path+method match, so two independent conn.routes.register calls on the
 *  same topic silently shadow each other. Keep exactly one REP route per
 *  (conn, path, method) and fan incoming data out to every subscriber. */
const topicsByConn = new WeakMap<ManagerApi, Map<string, Topic>>();

function createTopic(path: string, method: string): Topic {
    const handlers = new Set<BroadcastHandler>();
    return {
        handlers,
        route: {
            path,
            method,
            handler: request => {
                const data = request.getData();
                for (const handler of [...handlers]) {
                    const [error] = noTry(() => handler(data));
                    if (error)
                        reportClientError({
                            source: `broadcast:${method} ${path}`,
                            message: error.message,
                            stack: error.stack,
                        });
                }
            },
        },
    };
}

function subscribeBroadcast(
    conn: ManagerApi,
    path: string,
    method: string,
    handler: BroadcastHandler,
): () => void {
    const topics = topicsByConn.get(conn) ?? new Map<string, Topic>();
    topicsByConn.set(conn, topics);

    const key = `${method} ${path}`;
    const existing = topics.get(key);
    const topic = existing ?? createTopic(path, method);
    if (!existing) {
        topics.set(key, topic);
        conn.routes.register(topic.route);
    }

    topic.handlers.add(handler);
    let active = true;
    return () => {
        if (!active) return;
        active = false;

        topic.handlers.delete(handler);
        if (topic.handlers.size) return;

        if (topics.get(key) === topic) topics.delete(key);
        conn.routes.unregister(topic.route);
    };
}

/** Subscribe to a server broadcast topic while mounted. The handler is read
 *  through a ref so callers can pass inline closures without re-registering
 *  on every render. */
export function useWsBroadcast(
    conn: ManagerApi,
    path: string,
    method: string,
    handler: (data: unknown) => void,
): void {
    const handlerRef = useLatest(handler);

    useEffect(
        () =>
            subscribeBroadcast(conn, path, method, data =>
                handlerRef.current(data),
            ),
        [conn, path, method, handlerRef],
    );
}
