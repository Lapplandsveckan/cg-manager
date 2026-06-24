import { type BaseFixture } from '../types';

export const fixtureSummary = (fixture: BaseFixture, index: number): string => {
    const type = fixture.type ?? '—';
    const count = fixture.fixtureCount ?? '1';
    const start = fixture.startAddress ?? 1;
    return `${index + 1}. ${type} × ${count} · DMX ${start}`;
};
