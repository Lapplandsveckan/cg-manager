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
    port: 6454,
    universe: 0,
    type: 'RGB',
    startAddress: 1,
    fixtureCount: '1',
    fixtureChannels: 3,
    flux: { r: 1, g: 1, b: 1, w: 1 },
    brightness: 1,
    rotation: 0,
    mirrorX: false,
    mirrorY: false,
    left: Math.round(canvasWidth / 2 - 100),
    top: Math.round(canvasHeight / 2 - 50),
    width: 200,
    height: 100,
});

export const buildV2FixtureFields = (
    t: TFn,
): {
    HOST_FIELD: FieldDef;
    PORT_FIELD: FieldDef;
    UNIVERSE_FIELD: FieldDef;
    LEFT_FIELD: FieldDef;
    TOP_FIELD: FieldDef;
    FLUX_FIELDS: FieldDef[];
    BRIGHTNESS_FIELD: FieldDef;
    ROTATION_FIELD: FieldDef;
    MIRROR_X_FIELD: FieldDef;
    MIRROR_Y_FIELD: FieldDef;
} => ({
    HOST_FIELD: {
        key: 'host',
        label: t('config.fields.host'),
        type: 'string',
    },
    PORT_FIELD: {
        key: 'port',
        label: t('config.fields.port'),
        type: 'integer',
    },
    UNIVERSE_FIELD: {
        key: 'universe',
        label: t('config.fields.universe'),
        type: 'integer',
    },
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
    BRIGHTNESS_FIELD: {
        key: 'brightness',
        label: t('config.fields.brightness'),
        type: 'number',
    },
    ROTATION_FIELD: {
        key: 'rotation',
        label: t('config.fields.rotation'),
        type: 'number',
    },
    MIRROR_X_FIELD: {
        key: 'mirrorX',
        label: t('config.fields.mirrorX'),
        type: 'boolean',
    },
    MIRROR_Y_FIELD: {
        key: 'mirrorY',
        label: t('config.fields.mirrorY'),
        type: 'boolean',
    },
});
