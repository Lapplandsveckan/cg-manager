import { type IncomingMessage, type ServerResponse } from 'http';
import { MiddlewareProhibitFurtherExecution } from 'rest-exchange-protocol';
import { noTryAsync } from 'no-try';
import { type Logger } from '../../../util/log';

const end = (response: ServerResponse, status: number, body: string): never => {
    response.statusCode = status;
    response.end(body);

    throw new MiddlewareProhibitFurtherExecution();
};

/** An SDP offer is a few KiB. The guest WHIP endpoint is reachable by anyone
 *  holding a share link, so an unbounded read here is a free OOM. */
const MAX_OFFER_BYTES = 64 * 1024;

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of request as unknown as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > MAX_OFFER_BYTES) throw new OfferTooLarge();

        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
}

class OfferTooLarge extends Error {}

/** The POST-offer/201-answer handshake shared by WHEP (egress) and WHIP
 *  (ingress). Always ends the response, so it never returns normally. */
export async function exchangeSdp(
    request: IncomingMessage,
    response: ServerResponse,
    logger: Logger,
    open: (sdpOffer: string) => Promise<string>,
    /** Guests get a generic failure: the real messages name share labels,
     *  session caps and loopback port ranges. */
    expose: 'detail' | 'generic' = 'detail',
): Promise<never> {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return end(response, 405, 'Method Not Allowed');
    }

    const [readErr, sdpOffer] = await noTryAsync(() => readBody(request));
    if (readErr instanceof OfferTooLarge)
        return end(response, 413, 'SDP offer too large');
    if (readErr) return end(response, 400, 'Could not read SDP offer');
    if (!sdpOffer.trim()) return end(response, 400, 'Empty SDP offer');

    const [err, sdpAnswer] = await noTryAsync(() => open(sdpOffer));
    if (err || !sdpAnswer) {
        logger.warn(`SDP exchange failed: ${(err as Error)?.message}`);
        const detail = expose === 'detail' ? (err as Error)?.message : null;

        return end(response, 503, detail ?? 'Failed to open session');
    }

    response.statusCode = 201;
    response.setHeader('Content-Type', 'application/sdp');
    response.setHeader('Location', request.url ?? '');
    response.end(sdpAnswer);

    throw new MiddlewareProhibitFurtherExecution();
}
