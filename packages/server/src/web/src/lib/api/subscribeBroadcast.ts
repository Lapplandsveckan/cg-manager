import { noTry } from 'no-try';
import { type REPClient, type Route } from 'rest-exchange-protocol-client';
import { reportClientError } from '../reportClientError';

type Routes = REPClient['routes'];

type BroadcastHandler = (data: unknown) => void;

/** Server broadcasts are delivered to *passive* REP routes. A normal route is
 *  matched exclusively — the most specific match wins and shadows the rest, so
 *  two subscribers on one topic used to need a fan-out layer in front of them.
 *  Every passive route matching a path+method fires instead, in registration
 *  order, and its return value is discarded. Always register through here: a
 *  passive handler that throws aborts the rest of the chain and turns the
 *  broadcast into an error reply, so each one is contained. */
export function subscribeBroadcast(
    routes: Routes,
    path: string,
    method: string,
    handler: BroadcastHandler,
): () => void {
    const route: Route = {
        path,
        method,
        passive: true,
        handler: request => {
            const [error] = noTry(() => handler(request.getData()));
            if (!error) return;

            reportClientError({
                source: `broadcast:${method} ${path}`,
                message: error.message,
                stack: error.stack,
            });
        },
    };

    routes.register(route);
    return () => routes.unregister(route);
}
