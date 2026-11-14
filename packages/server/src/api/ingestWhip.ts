import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import { Logger } from '../util/log';
import { type IngestManager } from '../manager/wrtc/ingest/ingest';
import { exchangeSdp } from '../manager/wrtc/shared/whip';

const logger = Logger.scope('Ingest');

const GUEST = /^\/api\/public\/ingest\/([^/?]+)(\/whip)?(?:\?.*)?$/;
const OPERATOR = /^\/ingest-whip(?:\?(.*))?$/;

const labelFrom = (query: string | undefined) =>
    new URLSearchParams(query ?? '').get('label') ?? 'Local share';

/** Both ways in: a logged-in operator sharing their own screen, and a guest
 *  holding nothing but a share link. No DELETE endpoint — ICE/DTLS state
 *  transitions handle teardown, same as the preview path. */
export function ingestWhipMiddleware(ingest: IngestManager) {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http') return;

        const url = data.request.url ?? '';

        const operator = url.match(OPERATOR);
        if (operator)
            return exchangeSdp(
                data.request,
                data.response,
                logger,
                async sdpOffer => {
                    const session = await ingest.openSession({
                        sdpOffer,
                        label: labelFrom(operator[1]),
                    });

                    return {
                        sdpAnswer: session.sdpAnswer,
                        sessionId: session.id,
                    };
                },
            );

        const guest = url.match(GUEST);
        if (!guest) return;

        // The gate already checked the token, but auth may be disabled entirely.
        const share = ingest.shareByToken(guest[1]);
        if (!share) {
            data.response.statusCode = 404;
            data.response.end('Not found');
            throw new MiddlewareProhibitFurtherExecution();
        }

        if (!guest[2]) {
            if (data.request.method !== 'GET') {
                data.response.statusCode = 405;
                data.response.setHeader('Allow', 'GET');
                data.response.end('Method Not Allowed');
                throw new MiddlewareProhibitFurtherExecution();
            }

            data.response.statusCode = 200;
            data.response.setHeader('Content-Type', 'application/json');
            data.response.end(
                JSON.stringify({
                    label: share.label,
                    allowAudio: share.allowAudio,
                }),
            );
            throw new MiddlewareProhibitFurtherExecution();
        }

        return exchangeSdp(
            data.request,
            data.response,
            logger,
            async sdpOffer => {
                const session = await ingest.openSession({
                    sdpOffer,
                    shareId: share.id,
                    label: share.label,
                    allowAudio: share.allowAudio,
                });

                return {
                    sdpAnswer: session.sdpAnswer,
                    sessionId: session.id,
                };
            },
            'generic',
        );
    };
}
