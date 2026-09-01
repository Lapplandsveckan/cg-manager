import React from 'react';
import { Box, Stack } from '@mui/material';
import { ScalarField } from './fields/ScalarField';
import { ObjectField } from './fields/ObjectField';
import { ArrayField } from './fields/ArrayField';

// A recursive `ConfigValue` union is possible but has a wide blast radius
// through ObjectField/ArrayField/useFixtureList/ConsumerModal and may fight
// the `_name`-tagged arrays from the XML round-trip — left as `any` for now.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RecordData = Record<string, any>;

export type ScalarValue = string | number | boolean | undefined;

// Nested `object`/`array` fields hand back a whole RecordData (or list of
// them) instead of a scalar, so the shared onChange callback must accept both.
export type FieldValue = ScalarValue | RecordData | RecordData[];

export type FieldDef =
    | {
          key: string;
          label: string;
          type: 'string' | 'number' | 'integer' | 'boolean';
      }
    | {
          key: string;
          label: string;
          type: 'enum';
          options: readonly (string | number)[];
      }
    | { key: string; label: string; type: 'object'; fields: FieldDef[] }
    | {
          key: string;
          label: string;
          type: 'array';
          itemLabel: string;
          fields: FieldDef[];
      };

export type ScalarFieldDef = Extract<
    FieldDef,
    { type: 'string' | 'number' | 'integer' | 'boolean' | 'enum' }
>;

// A `Record` keyed by ScalarFieldDef['type'] rather than a plain array so
// adding a new scalar variant to FieldDef without listing it here is a
// compile error — `isScalar` can't silently mis-narrow an unlisted type.
const SCALAR_TYPES: Record<ScalarFieldDef['type'], true> = {
    string: true,
    number: true,
    integer: true,
    boolean: true,
    enum: true,
};
const isScalar = (def: FieldDef): def is ScalarFieldDef =>
    def.type in SCALAR_TYPES;

const ScalarGrid: React.FC<{
    fields: ScalarFieldDef[];
    data: RecordData;
    onChange: (key: string, value: ScalarValue) => void;
}> = ({ fields, data, onChange }) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 1.5,
        }}
    >
        {fields.map(def => (
            <ScalarField
                key={def.key}
                def={def}
                value={data[def.key]}
                onChange={v => onChange(def.key, v)}
            />
        ))}
    </Box>
);

interface FieldsProps {
    fields: FieldDef[];
    data: RecordData;
    onChange: (key: string, value: FieldValue) => void;
}

export const Fields: React.FC<FieldsProps> = ({ fields, data, onChange }) => {
    const scalars = fields.filter(isScalar);
    const nested = fields.filter(f => !isScalar(f));
    return (
        <Stack spacing={2}>
            {scalars.length > 0 && (
                <ScalarGrid fields={scalars} data={data} onChange={onChange} />
            )}
            {nested.map(def =>
                def.type === 'object' ? (
                    <ObjectField
                        key={def.key}
                        def={def}
                        value={data[def.key]}
                        onChange={v => onChange(def.key, v)}
                    />
                ) : def.type === 'array' ? (
                    <ArrayField
                        key={def.key}
                        def={def}
                        value={data[def.key]}
                        onChange={v => onChange(def.key, v)}
                    />
                ) : null,
            )}
        </Stack>
    );
};

export {
    CONSUMER_TYPES,
    CONSUMER_FIELDS,
    ARTNET_FIXTURE_FIELDS,
    ARTNET_SCALAR_FIELDS,
    formatConsumerType,
    type ConsumerType,
} from './fields/consumerFields';
export { ScalarField, useLabel } from './fields/ScalarField';
