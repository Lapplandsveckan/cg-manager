import type { SourceType } from './components/RouteSourceTypePicker';

export const INSPECT_EVENT = 'cg-routes:inspect';

export type InspectRequest =
    { edit: string } | { delete: string } | { create: SourceType };

export const openRouteInspector = (request: InspectRequest) =>
    window.dispatchEvent(new CustomEvent(INSPECT_EVENT, { detail: request }));
