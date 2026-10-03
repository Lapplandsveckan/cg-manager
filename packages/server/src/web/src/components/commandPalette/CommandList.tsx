import {
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    ListSubheader,
    Typography,
} from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import type { Row } from './arrange';
import { isParent, type Command } from './types';

const DANGER_COLOR = '#e88c8c';

interface CommandListProps {
    rows: Row[];
    activeIndex: number;
    showSection: boolean;
    onHover: (index: number) => void;
    onChoose: (command: Command) => void;
}

const secondaryText = (command: Command): string | undefined =>
    typeof command.disabled === 'string'
        ? command.disabled
        : command.description;

const scrollWhenActive = (active: boolean) => (element: HTMLElement | null) => {
    if (active) element?.scrollIntoView({ block: 'nearest' });
};

type CommandRow = Extract<Row, { kind: 'command' }>;

interface RowGroup {
    key: string;
    label?: string;
    rows: CommandRow[];
}

const groupRows = (rows: Row[]): RowGroup[] =>
    rows.reduce<RowGroup[]>((groups, row) => {
        if (row.kind === 'header')
            return [...groups, { key: row.key, label: row.label, rows: [] }];

        const last = groups[groups.length - 1];
        if (!last) return [{ key: row.key, rows: [row] }];

        last.rows.push(row);
        return groups;
    }, []);

export const CommandList: React.FC<CommandListProps> = ({
    rows,
    activeIndex,
    showSection,
    onHover,
    onChoose,
}) => (
    <List
        dense
        subheader={<li />}
        sx={{ pb: 1, maxHeight: '60vh', overflowY: 'auto' }}
    >
        {groupRows(rows).map(group => (
            <li key={group.key}>
                <ul style={{ padding: 0 }}>
                    {group.label && (
                        <ListSubheader sx={{ lineHeight: '28px' }}>
                            {group.label}
                        </ListSubheader>
                    )}
                    {group.rows.map(({ key, command, index }) => {
                        const color = command.danger ? DANGER_COLOR : undefined;

                        return (
                            <ListItemButton
                                key={key}
                                component="li"
                                ref={scrollWhenActive(index === activeIndex)}
                                selected={index === activeIndex}
                                disabled={Boolean(command.disabled)}
                                onMouseEnter={() => onHover(index)}
                                onClick={() => onChoose(command)}
                                sx={{ color }}
                            >
                                {command.icon && (
                                    <ListItemIcon sx={{ color, minWidth: 36 }}>
                                        {command.icon}
                                    </ListItemIcon>
                                )}
                                <ListItemText
                                    primary={command.label}
                                    secondary={secondaryText(command)}
                                />
                                {showSection && command.section && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {command.section}
                                    </Typography>
                                )}
                                {command.shortcut && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ ml: 1 }}
                                    >
                                        {command.shortcut}
                                    </Typography>
                                )}
                                {isParent(command) && (
                                    <ChevronRightRoundedIcon fontSize="small" />
                                )}
                            </ListItemButton>
                        );
                    })}
                </ul>
            </li>
        ))}
    </List>
);
