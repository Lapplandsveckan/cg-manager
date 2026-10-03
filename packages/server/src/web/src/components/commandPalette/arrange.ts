import type { Command } from './types';

export type Row =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'command'; key: string; command: Command; index: number };

function groupBySection(commands: Command[]): Command[] {
    const groups = new Map<string, Command[]>();

    commands.forEach(command => {
        const key = command.section ?? '';
        groups.set(key, [...(groups.get(key) ?? []), command]);
    });

    return [...groups.values()].flat();
}

export function arrangeRoot(
    commands: Command[],
    recentIds: string[],
    recentLabel: string,
): Command[] {
    const grouped = groupBySection(commands);

    const recents = recentIds
        .map(id => grouped.find(command => command.id === id))
        .filter((command): command is Command => Boolean(command))
        .map(command => ({ ...command, section: recentLabel }));

    const rest = grouped.filter(command => !recentIds.includes(command.id));

    return [...recents, ...rest];
}

export function toRows(commands: Command[], withHeaders: boolean): Row[] {
    return commands.flatMap((command, index): Row[] => {
        const startsSection =
            withHeaders &&
            Boolean(command.section) &&
            command.section !== commands[index - 1]?.section;

        const row: Row = {
            kind: 'command',
            key: `c-${index}-${command.id}`,
            command,
            index,
        };
        if (!startsSection) return [row];

        const header: Row = {
            kind: 'header',
            key: `h-${index}`,
            label: command.section ?? '',
        };
        return [header, row];
    });
}

export function stepEnabled(
    commands: Command[],
    from: number,
    direction: 1 | -1,
): number {
    const count = commands.length;

    for (let offset = 1; offset <= count; offset += 1) {
        const index = (from + direction * offset + count * count) % count;
        if (!commands[index].disabled) return index;
    }

    return from;
}
