import {Logger} from '../util/log';
import {Method} from 'rest-exchange-protocol';
import {Route} from 'rest-exchange-protocol/dist/route';
import files from './_routes';

export type RouteExport = {
    [key in Method]?: Route['handler'];
}

export function loadRoutes() {
    const logger = Logger.scope('API');
    logger.info('Loading routes...');

    const routes: Route[] = [];
    files.forEach((file) => {
        try {
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
        } catch (e) {
            logger.error(e);
            logger.error(`Failed to load route: ${file}`);
        }
    });

    return routes;
}