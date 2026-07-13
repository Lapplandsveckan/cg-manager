import React from 'react';
import { Box, Stack } from '@mui/material';
import { ScalarField } from './fields/ScalarField';
import { ObjectField } from './fields/ObjectField';
import { ArrayField } from './fields/ArrayField';

export type RecordData = Record<string, any>;

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

const SCALAR_TYPES = ['string', 'number', 'integer', 'boolean', 'enum'];
const isScalar = (def: FieldDef): boolean => SCALAR_TYPES.includes(def.type);

const ScalarGrid: React.FC<{
    fields: FieldDef[];
    data: RecordData;
    onChange: (key: string, value: any) => void;
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
                def={def as any}
                value={data[def.key]}
                onChange={v => onChange(def.key, v)}
            />
        ))}
    </Box>
);

interface FieldsProps {
    fields: FieldDef[];
    data: RecordData;
    onChange: (key: string, value: any) => void;
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
