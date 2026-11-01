import { Method, topic } from '@web-lib';
import {
    type IngestSession,
    type ShareLink,
} from '../../../../web/src/lib/api/ingest';

export const PLUGIN = 'screenshare';
export const API_ROOT = `/api/plugin/${PLUGIN}`;

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
