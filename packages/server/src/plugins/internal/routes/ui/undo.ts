import { createPluginUndo } from '@web-lib';

export const routeUndo = createPluginUndo('routes');

export const routeKey = (id: string) => `route:${id}`;

export const routeScope = (id: string) => routeUndo.scope(routeKey(id));
