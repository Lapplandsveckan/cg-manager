import { noTry } from 'no-try';
import { type CheckedRepClient } from './repClient';
import { reportClientError } from '../reportClientError';

type Routes = CheckedRepClient['routes'];

type BroadcastHandler = (data: unknown) => void;

/** Wrapped so the same function reference can subscribe more than once —
 *  each `subscribe()` call gets its own identity to unsubscribe by. */
interface Subscription {
    fn: BroadcastHandler;
}

interface Topic {
    route: {
        path: string;
        method: string;
        handler: (request: { getData: () => unknown }) => void;
    };
    subscriptions: Subscription[];
}

function createTopic(path: string, method: string): Topic {
    const subscriptions: Subscription[] = [];
    return {
        subscriptions,
        route: {
            // rest-exchange-protocol-client's Gateway.findRoute strips a leading
            // path segment unconditionally, so a route must have a leading `/`
            // to match against an incoming URL that never has one.
            path: path.startsWith('/') ? path : `/${path}`,
            method,
            handler: request => {
                const data = request.getData();
                for (const { fn } of [...subscriptions]) {
                    const [error] = noTry(() => fn(data));
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

/** REP dispatches an incoming message to the FIRST registered route whose
 *  path+method match, so two independent `routes.register` calls on the same
 *  topic silently shadow each other. This is the only place allowed to touch
 *  `Routes.register`/`unregister` for a connection — it keeps exactly one REP
 *  route per (path, method) and fans incoming data out to every subscriber. */
export class BroadcastDispatcher {
    private readonly topics = new Map<string, Topic>();

    constructor(private readonly routes: Routes) {}

    public subscribe(
        path: string,
        method: string,
        handler: BroadcastHandler,
    ): () => void {
        const key = `${method} ${path}`;
        const existing = this.topics.get(key);
        const topic = existing ?? createTopic(path, method);
        if (!existing) {
            this.topics.set(key, topic);
            this.routes.register(topic.route);
        }

        const subscription: Subscription = { fn: handler };
        topic.subscriptions.push(subscription);
        let active = true;
        return () => {
            if (!active) return;
            active = false;

            topic.subscriptions.splice(
                topic.subscriptions.indexOf(subscription),
                1,
            );
            if (topic.subscriptions.length) return;

            if (this.topics.get(key) === topic) this.topics.delete(key);
            this.routes.unregister(topic.route);
        };
    }
}
