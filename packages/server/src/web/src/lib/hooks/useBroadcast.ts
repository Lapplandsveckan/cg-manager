import { useEffect } from 'react';
import { type BroadcastTopic } from '../api/broadcasts';
import { reportClientError } from '../reportClientError';
import { useLatest } from './useLatest';
import { useSocket } from './useSocket';

/** One report per (path, method) is enough to flag a server/client payload
 *  mismatch — a high-frequency topic with N subscribers must not turn one
 *  malformed broadcast into N requests to `/api/log/client`. */
const reportedTopics = new Set<string>();

/** Subscribe to a server broadcast topic while mounted. The handler is read
 *  through a ref so callers can pass inline closures without re-registering
 *  on every render. Fan-out for topics with multiple subscribers is handled
 *  by `ManagerApi.subscribe` (`BroadcastDispatcher`), not here. */
export function useBroadcast<T>(
    topic: BroadcastTopic<T>,
    handler: (data: T) => void,
): void {
    const conn = useSocket();
    const handlerRef = useLatest(handler);

    useEffect(
        () =>
            conn.subscribe(topic.path, topic.method, data => {
                if (!topic.isValid(data)) {
                    const key = `${topic.method} ${topic.path}`;
                    if (!reportedTopics.has(key)) {
                        reportedTopics.add(key);
                        reportClientError({
                            source: `broadcast:${key}`,
                            message: `payload failed validation: ${JSON.stringify(data)?.slice(0, 200)}`,
                        });
                    }
                    return;
                }
                handlerRef.current(data);
            }),
        [conn, topic, handlerRef],
    );
}
