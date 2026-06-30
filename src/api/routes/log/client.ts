import { type RouteExport } from '../../route';
import { Logger } from '../../../util/log';

const logger = Logger.scope('WebClient');

interface ClientErrorPayload {
    source?: string;
    message?: string;
    stack?: string;
    componentStack?: string;
    url?: string;
}

export default {
    ACTION: async request => {
        const data = (request.getData() ?? {}) as ClientErrorPayload;
        const source = data.source ?? 'unknown';
        const message = data.message ?? 'Unknown client error';

        let log = `[${source}] ${message}`;
        if (data.url) log += ` @ ${data.url}`;
        if (data.componentStack)
            log += `\nComponent stack:${data.componentStack}`;
        if (data.stack) log += `\n${data.stack}`;

        logger.error(log);
        return null;
    },
} satisfies RouteExport;
