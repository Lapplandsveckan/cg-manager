import { type ScalarFieldDef } from '../../fields';
import { type LegacyFixture } from '../types';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const newFixtureLegacy = (): LegacyFixture => ({
    type: 'RGB',
    startAddress: 1,
    fixtureCount: 1,
    fixtureChannels: 3,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
});

export const buildLegacyFixtureFields = (
    t: TFn,
): {
    X_FIELD: ScalarFieldDef;
    Y_FIELD: ScalarFieldDef;
    ROTATION_FIELD: ScalarFieldDef;
    FIXTURE_COUNT_FIELD: ScalarFieldDef;
} => ({
    X_FIELD: { key: 'x', label: 'X', type: 'integer' },
    Y_FIELD: { key: 'y', label: 'Y', type: 'integer' },
    ROTATION_FIELD: {
        key: 'rotation',
        label: t('config.fields.rotation'),
        type: 'number',
    },
    FIXTURE_COUNT_FIELD: {
        key: 'fixtureCount',
        label: t('config.fields.fixtureCountInt'),
        type: 'integer',
    },
});
