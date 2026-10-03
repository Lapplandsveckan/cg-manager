import { Method, topic } from '@web-lib';
import type { RecordingEntry } from '../recordings';

export const PLUGIN = 'recorder';
export const API_ROOT = `/api/plugin/${PLUGIN}`;

export const recordingsUpdated = topic(
    `plugin/${PLUGIN}/recordings`,
    Method.UPDATE,
    (data): data is RecordingEntry[] => Array.isArray(data),
);
