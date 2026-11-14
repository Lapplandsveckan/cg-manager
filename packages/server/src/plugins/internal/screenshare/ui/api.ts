import { Method, topic } from '@web-lib';
import {
    type IngestSession,
    type ShareLink,
} from '../../../../web/src/lib/api/ingest';

export const PLUGIN = 'screenshare';
export const API_ROOT = `/api/plugin/${PLUGIN}`;

export const SESSIONS_PATH = `${API_ROOT}/sessions`;
export const SHARES_PATH = `${API_ROOT}/shares`;
export const SHOWN_PATH = `${API_ROOT}/shown`;

export const sessionPath = (id: string) =>
    `${SESSIONS_PATH}/${encodeURIComponent(id)}`;

export const sessionActionPath = (id: string, action: 'show' | 'hide') =>
    `${sessionPath(id)}/${action}`;

export const sharePath = (id: string) =>
    `${SHARES_PATH}/${encodeURIComponent(id)}`;

export const sessionsUpdated = topic(
    'ingest/sessions',
    Method.UPDATE,
    (data): data is IngestSession[] => Array.isArray(data),
);

export const sharesUpdated = topic(
    'ingest/shares',
    Method.UPDATE,
    (data): data is ShareLink[] => Array.isArray(data),
);
