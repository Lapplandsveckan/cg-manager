import React from 'react';
import { Stack } from '@mui/material';
import { useTranslation } from 'next-i18next';
import { ScalarField } from '../../fields';
import { FixtureDetailsShell } from '../shared/FixtureDetailsShell';
import { buildSharedFixtureFields } from '../shared/fixtureFields';
import { buildLegacyFixtureFields } from './legacyFixture';
import { type LegacyFixture } from '../types';

interface LegacyFixtureDetailsProps {
    index: number;
    fixture: LegacyFixture;
    onChange: (key: string, value: any) => void;
    onDelete: () => void;
}

export const LegacyFixtureDetails: React.FC<LegacyFixtureDetailsProps> = ({
    index,
    fixture,
    onChange,
    onDelete,
}) => {
    const { t } = useTranslation('common');
    const S = buildSharedFixtureFields(t);
    const L = buildLegacyFixtureFields(t);

    return (
        <FixtureDetailsShell
            index={index}
            fixture={fixture}
            onChange={onChange}
            onDelete={onDelete}
        >
            <ScalarField
                def={L.FIXTURE_COUNT_FIELD as any}
                value={fixture.fixtureCount}
                onChange={v => onChange('fixtureCount', v)}
            />
            <Stack direction="row" gap={1.5}>
                <ScalarField
                    def={L.X_FIELD as any}
                    value={fixture.x}
                    onChange={v => onChange('x', v)}
                />
                <ScalarField
                    def={L.Y_FIELD as any}
                    value={fixture.y}
                    onChange={v => onChange('y', v)}
                />
            </Stack>
            <Stack direction="row" gap={1.5}>
                <ScalarField
                    def={S.WIDTH_FIELD as any}
                    value={fixture.width}
                    onChange={v => onChange('width', v)}
                />
                <ScalarField
                    def={S.HEIGHT_FIELD as any}
                    value={fixture.height}
                    onChange={v => onChange('height', v)}
                />
            </Stack>
            <ScalarField
                def={L.ROTATION_FIELD as any}
                value={fixture.rotation}
                onChange={v => onChange('rotation', v)}
            />
        </FixtureDetailsShell>
    );
};
