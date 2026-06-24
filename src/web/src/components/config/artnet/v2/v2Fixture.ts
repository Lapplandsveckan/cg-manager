import { type FieldDef } from '../../fields';
import { type V2Fixture } from '../types';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const parseCount = (
    str: string | number | undefined,
): { w: number; h: number } => {
    if (!str) return { w: 1, h: 1 };
    const m = String(str).match(/^(\d+)(?:x(\d+))?$/i);
    if (!m) return { w: 1, h: 1 };
    return {
        w: parseInt(m[1], 10) || 1,
        h: m[2] ? parseInt(m[2], 10) || 1 : 1,
    };
};

export const formatCount = (w: number, h: number): string => {
    const W = Math.max(1, Math.round(w));
    const H = Math.max(1, Math.round(h));
    return H === 1 ? String(W) : `${W}x${H}`;
};

export const newFixture = (
    canvasWidth: number,
    canvasHeight: number,
): V2Fixture => ({
    type: 'RGB',
    startAddress: 1,
    fixtureCount: '1',
    fixtureChannels: 3,
    flux: { r: 1, g: 1, b: 1, w: 1 },
    left: Math.round(canvasWidth / 2 - 100),
    top: Math.round(canvasHeight / 2 - 50),
    width: 200,
    height: 100,
});

export const buildV2FixtureFields = (
    t: TFn,
): {
    LEFT_FIELD: FieldDef;
    TOP_FIELD: FieldDef;
    FLUX_FIELDS: FieldDef[];
} => ({
    LEFT_FIELD: {
        key: 'left',
        label: t('config.fields.left'),
        type: 'integer',
    },
    TOP_FIELD: {
        key: 'top',
        label: t('config.fields.top'),
        type: 'integer',
    },
    FLUX_FIELDS: [
        { key: 'r', label: 'R', type: 'number' },
        { key: 'g', label: 'G', type: 'number' },
        { key: 'b', label: 'B', type: 'number' },
        { key: 'w', label: 'W', type: 'number' },
    ],
});
