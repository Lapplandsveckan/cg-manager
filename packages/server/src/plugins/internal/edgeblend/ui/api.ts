import { Method, topic } from '@web-lib';
import type { StoredLayout } from './LayoutEditor';

export const PLUGIN = 'edgeblend';
export const API_ROOT = `/api/plugin/${PLUGIN}`;

export const layoutsUpdated = topic(
    `plugin/${PLUGIN}/layouts`,
    Method.UPDATE,
    (data): data is StoredLayout[] => Array.isArray(data),
);
