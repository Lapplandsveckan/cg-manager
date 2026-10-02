import { type RouteExport } from '../../route';
import { parseBody } from '../../validate';
import { Logger } from '../../../util/log';
import { captureClientError } from '../../../util/telemetry';
import { clientErrorBody } from '../../../schemas/log';

const logger = Logger.scope('WebClient');

export default {
    ACTION: async request => {
        const data = parseBody(clientErrorBody, request);
        const source = data.source ?? 'unknown';
        const message = data.message ?? 'Unknown client error';

        let log = `[${source}] ${message}`;
        if (data.url) log += ` @ ${data.url}`;
        if (data.componentStack)
            log += `\nComponent stack:${data.componentStack}`;
        if (data.stack) log += `\n${data.stack}`;

        logger.error(log);
        captureClientError({
            source,
            message,
            stack: data.stack,
            componentStack: data.componentStack,
            url: data.url,
        });
        return null;
    },
} satisfies RouteExport;
