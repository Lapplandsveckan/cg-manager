import { type FieldDef } from '../../fields';

type TFn = (key: string, opts?: Record<string, unknown>) => string;

export const buildSharedFixtureFields = (
    t: TFn,
): {
    TYPE_FIELD: FieldDef;
    START_ADDRESS_FIELD: FieldDef;
    CHANNELS_FIELD: FieldDef;
    WIDTH_FIELD: FieldDef;
    HEIGHT_FIELD: FieldDef;
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
