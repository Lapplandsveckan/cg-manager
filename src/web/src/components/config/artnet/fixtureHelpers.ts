import { type Fixture } from '../ArtnetCanvas';
import { type FieldDef } from '../fields';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const newFixture = (
    canvasWidth: number,
    canvasHeight: number,
): Fixture => ({
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

export const fixtureSummary = (fixture: Fixture, index: number): string => {
    const type = fixture.type ?? '—';
    const count = fixture.fixtureCount ?? '1';
    const start = fixture.startAddress ?? 1;
    return `${index + 1}. ${type} × ${count} · DMX ${start}`;
};

export const buildFixtureFields = (
    t: TFn,
): {
    TYPE_FIELD: FieldDef;
    START_ADDRESS_FIELD: FieldDef;
    CHANNELS_FIELD: FieldDef;
    LEFT_FIELD: FieldDef;
    TOP_FIELD: FieldDef;
    WIDTH_FIELD: FieldDef;
    HEIGHT_FIELD: FieldDef;
    FLUX_FIELDS: FieldDef[];
} => ({
    TYPE_FIELD: {
        key: 'type',
        label: t('config.fields.type'),
        type: 'enum',
        options: ['DIMMER', 'RGB', 'RGBW'],
    },
    START_ADDRESS_FIELD: {
        key: 'startAddress',
        label: t('config.fields.startAddress'),
        type: 'integer',
    },
    CHANNELS_FIELD: {
        key: 'fixtureChannels',
        label: t('config.fields.channelsPerFixture'),
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
    WIDTH_FIELD: {
        key: 'width',
        label: t('config.fields.width'),
        type: 'integer',
    },
    HEIGHT_FIELD: {
        key: 'height',
        label: t('config.fields.height'),
        type: 'integer',
    },
    FLUX_FIELDS: [
        { key: 'r', label: 'R', type: 'number' },
        { key: 'g', label: 'G', type: 'number' },
        { key: 'b', label: 'B', type: 'number' },
        { key: 'w', label: 'W', type: 'number' },
    ],
});
