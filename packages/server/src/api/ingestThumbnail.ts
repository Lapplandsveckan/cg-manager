import { type IncomingMessage } from 'http';
import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import { noTry, noTryAsync } from 'no-try';
import {
    MAX_THUMBNAIL_BYTES,
    type IngestManager,
} from '../manager/wrtc/ingest/ingest';

const OPERATOR = /^\/api\/ingest\/thumbnail\/([^/?]+)(?:\?.*)?$/;
const GUEST = /^\/api\/public\/ingest\/([^/?]+)\/thumbnail\/([^/?]+)(?:\?.*)?$/;

class TooLarge extends Error {}

/** A malformed escape would otherwise throw out of the handler as a 500. */
const decode = (value: string) => {
    const [, decoded] = noTry(() => decodeURIComponent(value));

    return decoded ?? '';
};

async function readImage(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of request as unknown as AsyncIterable<Buffer>) {
        size += chunk.length;
        if (size > MAX_THUMBNAIL_BYTES) throw new TooLarge();

        chunks.push(chunk);
    }

    return Buffer.concat(chunks);
}

/** Preview frames for the operator grid: the sender posts them (the ingest leg
 *  is a stream copy, so the host never has a decoded frame to make one from),
 *  and the operator UI reads the latest one back. */
export function ingestThumbnailMiddleware(ingest: IngestManager) {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http') return;

        const url = data.request.url ?? '';
        const operator = url.match(OPERATOR);
        const guest = url.match(GUEST);
        if (!operator && !guest) return;

        const end = (status: number, body?: Buffer): never => {
            data.response.statusCode = status;
            if (body) {
                data.response.setHeader('Content-Type', 'image/jpeg');
                data.response.setHeader('Cache-Control', 'no-store');
                data.response.setHeader('X-Content-Type-Options', 'nosniff');
            }
            data.response.end(body);

            throw new MiddlewareProhibitFurtherExecution();
        };

        const sessionId = decode(guest ? guest[2] : (operator[1] ?? ''));

        // A guest may only write to a session its own link opened; the share
        // token in the path is checked by the gate, the ownership here.
        if (guest) {
            const share = ingest.shareByToken(decode(guest[1]));
            if (ingest.shareIdOf(sessionId) !== share?.id) return end(404);
        }

        if (data.request.method === 'GET') {
            if (guest) return end(405);

            const image = ingest.getThumbnail(sessionId);
            return image ? end(200, image) : end(404);
        }

        if (data.request.method !== 'POST') {
            data.response.setHeader('Allow', guest ? 'POST' : 'GET, POST');
            return end(405);
        }

        const [err, image] = await noTryAsync(() => readImage(data.request));
        if (err instanceof TooLarge) {
            // Half-read request: nothing will drain the rest of the body.
            data.request.destroy();
            return end(413);
        }
        if (err) return end(400);

        return ingest.setThumbnail(sessionId, image) ? end(204) : end(404);
    };
}
