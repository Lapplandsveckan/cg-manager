import { type IngestSession, type PluginAPI } from '@lappis/cg-manager';
import { ScreenshareEffect } from './effects/screenshare';
import { type RouteSourceType } from './types';

export const ROUTE_SOURCE_POINT = 'routes:source-types';
export const ROUTE_SOURCE_TYPE = 'screenshare';

const shareIdOf = (source: Record<string, unknown>) =>
    typeof source.shareId === 'string' ? source.shareId : '';

const newest = (sessions: IngestSession[]) =>
    sessions.sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;

/** A route points at a share link, not at a session: sessions are minted per
 *  connection and die with it, while the link is what an operator hands out
 *  and a route persists. The route therefore lights up on its own whenever
 *  that guest (re)connects, which is the whole point of the tournament case. */
export function screenshareRouteSource(api: PluginAPI): RouteSourceType {
    return {
        type: ROUTE_SOURCE_TYPE,
        label: 'screenshare:routeSource.label',
        description: 'screenshare:routeSource.description',
        validate: source => !!shareIdOf(source),
        createEffect: ({ group, source, route }) => {
            const shareId = shareIdOf(source);
            const session = newest(
                api.ingest
                    .listSessions()
                    .filter(s => s.shareId === shareId && s.state !== 'closed'),
            );
            if (!session) return null;

            return new ScreenshareEffect(
                group,
                {
                    sessionId: session.id,
                    url: session.url,
                    label: session.label,
                    transform: route.transform,
                    edgeblend: route.edgeblend,
                    perspective: route.perspective,
                },
                api.ingest,
            );
        },
    };
}
