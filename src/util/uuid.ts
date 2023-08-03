import {v4} from 'uuid';

export type UUID = string;
export const UUID = {
    generate: v4,
};