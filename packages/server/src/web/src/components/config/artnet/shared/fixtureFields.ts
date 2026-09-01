import { type ScalarFieldDef } from '../../fields';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const buildSharedFixtureFields = (
    t: TFn,
): {
    TYPE_FIELD: ScalarFieldDef;
    START_ADDRESS_FIELD: ScalarFieldDef;
    CHANNELS_FIELD: ScalarFieldDef;
    WIDTH_FIELD: ScalarFieldDef;
    HEIGHT_FIELD: ScalarFieldDef;
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
});
