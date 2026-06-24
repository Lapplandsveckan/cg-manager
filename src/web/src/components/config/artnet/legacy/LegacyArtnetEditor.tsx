import React from 'react';
import { Stack } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { ScalarField } from '../../fields';
import { OutputCard } from '../shared/OutputCard';
import { FixturePanel } from '../shared/FixturePanel';
import { useFixtureList } from '../shared/useFixtureList';
import { fixtureSummary } from '../shared/fixtureSummary';
import { newFixtureLegacy } from './legacyFixture';
import { LegacyFixtureDetails } from './LegacyFixtureDetails';
import { type ArtnetVariantEditorProps, type LegacyFixture } from '../types';

export const LegacyArtnetEditor: React.FC<ArtnetVariantEditorProps> = ({
    data,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const {
        fixtures,
        selected,
        setSelected,
        addFixture,
        removeFixture,
        updateFixture,
    } = useFixtureList<LegacyFixture>(data, onChange, newFixtureLegacy);

    return (
        <Stack spacing={3}>
            <OutputCard
                data={data}
                onChange={(key, value) => onChange({ ...data, [key]: value })}
            >
                <ScalarField
                    def={
                        {
                            key: 'universe',
                            label: t('config.artnet.universe'),
                            type: 'integer',
                        } as any
                    }
                    value={(data as any).universe}
                    onChange={v => onChange({ ...data, universe: v })}
                />
            </OutputCard>

            <FixturePanel
                fixtures={fixtures}
                selected={selected}
                onAdd={addFixture}
                onSelect={setSelected}
                onDelete={removeFixture}
                summary={fixtureSummary}
                renderDetails={(i, f) => (
                    <LegacyFixtureDetails
                        index={i}
                        fixture={f as LegacyFixture}
                        onChange={(k, v) => updateFixture(i, k, v)}
                        onDelete={() => removeFixture(i)}
                    />
                )}
                sx={{ width: '100%' }}
            />
        </Stack>
    );
};
