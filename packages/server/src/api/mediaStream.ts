import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import {
    MiddlewareProhibitFurtherExecution,
    type MiddleWareData,
    WebError,
} from 'rest-exchange-protocol';
import { noTry, noTryAsync } from 'no-try';
import { Logger } from '../util/log';
import { resolveMediaFile } from '../manager/scanner/locate';

const log = Logger.scope('Media');

const CONTENT_TYPES: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
};

/** Serve raw media bytes for browser `<video>` / `<img>` playback.
 *
 *  GET /api/caspar/media/raw/<encoded-id>
 *
 *  Supports HTTP Range (byte-range requests) so browsers can seek. The id
 *  is URL-decoded after extraction, so INTRO%2FCLIP and INTRO/CLIP both
 *  resolve to the same document. */
export function mediaStreamMiddleware() {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http') return;

        const method = data.request.method;
        if (method !== 'GET' && method !== 'HEAD') return;

        const urlPath = (data.request.url ?? '').split('?')[0];
        const match = urlPath.match(/^\/api\/caspar\/media\/raw\/(.+)$/);
        if (!match) return;

        const rawId = decodeURIComponent(match[1]);

        const reply = (status: number, msg: string): never => {
            data.response.statusCode = status;
            data.response.setHeader('Content-Type', 'text/plain');
            data.response.end(msg);
            throw new MiddlewareProhibitFurtherExecution();
        };

        const [locErr, resolved] = noTry(() => resolveMediaFile(rawId));
        if (locErr || !resolved)
            return reply(
                locErr instanceof WebError ? locErr.status : 404,
                locErr?.message ?? 'Not found',
            );

        const { mediaPath } = resolved;

        const [statErr, stat] = await noTryAsync(() => fs.stat(mediaPath));
        if (statErr || !stat) return reply(404, 'File not found on disk');

        const ext = path.extname(mediaPath).slice(1).toLowerCase();
        const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
        const size = stat.size;

        const sendStream = (opts?: { start: number; end: number }) => {
            if (method === 'HEAD') return void data.response.end();
            const stream = createReadStream(mediaPath, opts);
            data.request.on('close', () => stream.destroy());
            stream.on('error', err => {
                log.error(`Stream error: ${(err as Error).message}`);
                if (!data.response.writableEnded) data.response.destroy();
            });
            stream.pipe(data.response as any);
        };

        const rangeHeader = data.request.headers['range'] as string | undefined;

        // Multi-range requests (e.g. `bytes=0-99,200-299`) aren't supported;
        // serving the full body is a spec-compliant fallback.
        if (rangeHeader && !rangeHeader.includes(',')) {
            const parts = rangeHeader.replace(/bytes=/, '').split('-');
            const hasSuffix = parts[0] === '';
            const start = hasSuffix
                ? size - parseInt(parts[1], 10)
                : parseInt(parts[0], 10);
            const end =
                hasSuffix || parts[1] === ''
                    ? size - 1
                    : parseInt(parts[1], 10);

            if (
                isNaN(start) ||
                isNaN(end) ||
                start < 0 ||
                end >= size ||
                start > end
            ) {
                data.response.statusCode = 416;
                data.response.setHeader('Content-Range', `bytes */${size}`);
                data.response.end();
                throw new MiddlewareProhibitFurtherExecution();
            }

            data.response.statusCode = 206;
            data.response.setHeader('Content-Type', contentType);
            data.response.setHeader(
                'Content-Range',
                `bytes ${start}-${end}/${size}`,
            );
            data.response.setHeader('Content-Length', end - start + 1);
            data.response.setHeader('Accept-Ranges', 'bytes');
            sendStream({ start, end });
        } else {
            data.response.statusCode = 200;
            data.response.setHeader('Content-Type', contentType);
            data.response.setHeader('Content-Length', size);
            data.response.setHeader('Accept-Ranges', 'bytes');
            sendStream();
        }

        throw new MiddlewareProhibitFurtherExecution();
    };
}
