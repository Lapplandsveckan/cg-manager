import { useState } from 'react';
import { type RecordData } from '../../fields';
import { type BaseFixture } from '../types';

interface UseFixtureListResult<T extends BaseFixture> {
    fixtures: T[];
    selected: number | null;
    selectedFixture: T | null;
    setSelected: (i: number | null) => void;
    addFixture: () => void;
    removeFixture: (i: number) => void;
    updateFixture: (i: number, key: string, value: any) => void;
    updateFixtures: (next: T[]) => void;
}

export function useFixtureList<T extends BaseFixture>(
    data: RecordData,
    onChange: (data: RecordData) => void,
    makeFixture: () => T,
): UseFixtureListResult<T> {
    const [selected, setSelected] = useState<number | null>(null);
    const fixtures = (data.fixtures ?? []) as T[];

    const addFixture = () => {
        const next = [...fixtures, makeFixture()];
        onChange({ ...data, fixtures: next });
        setSelected(next.length - 1);
    };

    const removeFixture = (i: number) => {
        const next = fixtures.filter((_, idx) => idx !== i);
        onChange({ ...data, fixtures: next });
        if (selected === i) setSelected(null);
        else if (selected !== null && selected > i) setSelected(selected - 1);
    };

    const updateFixture = (i: number, key: string, value: any) => {
        const next = fixtures.map((f, idx) =>
            idx === i ? { ...f, [key]: value } : f,
        );
        onChange({ ...data, fixtures: next });
    };

    const updateFixtures = (next: T[]) => onChange({ ...data, fixtures: next });

    return {
        fixtures,
        selected,
        selectedFixture:
            selected !== null ? (fixtures[selected] ?? null) : null,
        setSelected,
        addFixture,
        removeFixture,
        updateFixture,
        updateFixtures,
    };
}
