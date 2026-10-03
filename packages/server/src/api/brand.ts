import {
    type MiddleWareData,
    MiddlewareProhibitFurtherExecution,
} from 'rest-exchange-protocol';
import config from '../util/config';
import { brandSchema } from '../schemas/brand';

const isGet = (data: MiddleWareData) =>
    data.type === 'http' && data.request.method === 'GET';

const resolveBrand = () => brandSchema.parse(config.brand ?? {});

export function brandScriptMiddleware() {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http' || !isGet(data)) return;
        if (!/^\/brand\.js(?:\?.*)?$/.test(data.request.url)) return;

        data.response.statusCode = 200;
        data.response.setHeader(
            'Content-Type',
            'application/javascript; charset=utf-8',
        );
        data.response.setHeader('X-Content-Type-Options', 'nosniff');
        data.response.setHeader('Cache-Control', 'no-store');
        data.response.end(
            `window.__CG_BRAND__ = ${JSON.stringify(resolveBrand())};`,
        );

        throw new MiddlewareProhibitFurtherExecution();
    };
}

export function brandHomeMiddleware() {
    return async (data: MiddleWareData) => {
        if (data.type !== 'http' || !isGet(data)) return;
        if (!/^\/(?:\?.*)?$/.test(data.request.url)) return;

        const { home } = resolveBrand();
        if (!home) return;

        data.response.statusCode = 302;
        data.response.setHeader('Location', home);
        data.response.end();

        throw new MiddlewareProhibitFurtherExecution();
    };
}
