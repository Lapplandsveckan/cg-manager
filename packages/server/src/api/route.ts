import { type Method } from 'rest-exchange-protocol';
import { type Route } from 'rest-exchange-protocol/dist/route';
import { noTry } from 'no-try';
import { Logger } from '../util/log';
import files from './_routes';

export type RouteExport = {
    [key in Method]?: Route['handler'];
};

export function loadRoutes() {
    const logger = Logger.scope('API');
    logger.info('Loading routes...');

    const routes: Route[] = [];
    files.forEach(file => {
        const [err] = noTry(() => {
            const fileName = file[0].replace(/\$/g, ':');
            const routeExport = file[1];

            Object.entries(routeExport).forEach(([method, handler]) => {
                logger.debug(`Loaded route: ${method} /api${fileName}`);

                routes.push({
                    method: method as Method,
                    path: `/api${fileName}`,
                    handler,
                });
            });
        });

        if (err) {
            logger.error(err);
            logger.error(`Failed to load route: ${file}`);
        }
    });

    return routes;
}
