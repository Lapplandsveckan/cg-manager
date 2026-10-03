import { useEffect, useMemo, useState } from 'react';
import {
    Chip,
    Dialog,
    InputAdornment,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useTranslation } from 'react-i18next';
import { createFuzzy } from '../../lib/fuzzy';
import { arrangeRoot, stepEnabled, toRows } from './arrange';
import { CommandList } from './CommandList';
import type { CommandRegistry } from './registry';
import { useCommandFrames } from './useCommandFrames';
import { useRecentCommands } from './useRecentCommands';
import { isDisabled, isParent, isPrompt, type Command } from './types';

const MAX_RESULTS = 60;
const SEARCH_KEYS = [
    { name: 'label', weight: 2 },
    'keywords',
    'description',
    'section',
];

interface CommandPaletteProps {
    registry: CommandRegistry;
    open: boolean;
    entry: string | null;
    onClose: () => void;
    onRun: (action: () => unknown) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    registry,
    open,
    entry,
    onClose,
    onRun,
}) => {
    const { t } = useTranslation('common');
    const { stack, top, items, loading, error, push, popTo, reset } =
        useCommandFrames(registry, open);
    const { recentIds, remember } = useRecentCommands();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (!open) return;

        const start = registry.collect().find(command => command.id === entry);
        const nested =
            start && !isDisabled(start) && (isParent(start) || isPrompt(start))
                ? start
                : undefined;

        reset(nested);
        setQuery(
            nested && isPrompt(nested) ? (nested.prompt.initial ?? '') : '',
        );
        setActiveIndex(0);
    }, [open, entry, registry, reset]);

    const isRoot = stack.length === 0;
    const prompting = Boolean(top && isPrompt(top));
    const grouped = isRoot && !query;

    const matches = useMemo(
        () => createFuzzy<Command>(items, SEARCH_KEYS)(query),
        [items, query],
    );

    const commands = useMemo(
        () =>
            grouped
                ? arrangeRoot(items, recentIds, t('commandPalette.recent'))
                : matches.slice(0, MAX_RESULTS),
        [grouped, items, matches, recentIds, t],
    );

    const rows = useMemo(() => toRows(commands, grouped), [commands, grouped]);
    const active = Math.min(activeIndex, Math.max(0, commands.length - 1));

    const promptValue = query.trim();
    const promptError =
        top && isPrompt(top) && promptValue
            ? (top.prompt.validate?.(promptValue) ?? null)
            : null;

    const enter = (command: Command) => {
        if (!isParent(command) && !isPrompt(command)) return;
        push(command);
        setQuery(isPrompt(command) ? (command.prompt.initial ?? '') : '');
        setActiveIndex(0);
    };

    const choose = (command: Command) => {
        if (isDisabled(command)) return;
        if (isParent(command) || isPrompt(command)) return enter(command);

        remember(stack[0]?.id ?? command.id);
        onRun(command.run);
    };

    const submitPrompt = () => {
        if (!top || !isPrompt(top)) return;
        if (!promptValue || promptError) return;

        remember(stack[0].id);
        onRun(() => top.prompt.submit(promptValue));
    };

    const goBackTo = (depth: number) => {
        popTo(depth);
        setQuery('');
        setActiveIndex(0);
    };

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.nativeEvent.isComposing) return;

        const target = event.target as HTMLInputElement;
        const atEnd = target.selectionStart === query.length;

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(stepEnabled(commands, active, direction));
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (prompting) return submitPrompt();
            if (commands[active]) choose(commands[active]);
            return;
        }

        if (event.key === 'Backspace' && !query && stack.length > 0) {
            event.preventDefault();
            goBackTo(stack.length - 1);
            return;
        }

        if (event.key === 'Tab') event.preventDefault();

        const drillKey =
            event.key === 'Tab' || (event.key === 'ArrowRight' && atEnd);
        const candidate = commands[active];
        if (drillKey && !prompting && candidate && isParent(candidate)) {
            event.preventDefault();
            choose(candidate);
        }
    };

    const placeholder =
        top && isPrompt(top)
            ? top.prompt.placeholder
            : ((top && isParent(top) ? top.placeholder : undefined) ??
              t('commandPalette.placeholder'));

    const promptLabel =
        top && isPrompt(top)
            ? (top.prompt.submitLabel?.(promptValue) ??
              t('commandPalette.prompt.submit', { value: promptValue }))
            : '';

    const emptyText = error ?? t('commandPalette.empty');

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
            PaperProps={{ sx: { mt: 10, backgroundImage: 'none' } }}
        >
            {stack.length > 0 && (
                <Stack direction="row" gap={0.5} sx={{ px: 2, pt: 2 }}>
                    <Chip
                        size="small"
                        label={t('commandPalette.title')}
                        onClick={() => goBackTo(0)}
                    />
                    {stack.map((frame, index) => (
                        <Chip
                            key={`${index}-${frame.id}`}
                            size="small"
                            label={frame.label}
                            onClick={() => goBackTo(index + 1)}
                        />
                    ))}
                </Stack>
            )}

            <TextField
                autoFocus
                fullWidth
                value={query}
                placeholder={placeholder}
                onChange={event => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                }}
                onKeyDown={onKeyDown}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                sx={{ p: 2 }}
            />

            {prompting && (
                <Typography
                    variant="body2"
                    sx={{
                        px: 3,
                        pb: 3,
                        color: promptError ? 'error.main' : 'text.secondary',
                    }}
                >
                    {promptError ??
                        (promptValue
                            ? promptLabel
                            : t('commandPalette.prompt.empty'))}
                </Typography>
            )}

            {!prompting && loading && commands.length === 0 && (
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', px: 3, pb: 3 }}
                >
                    {t('commandPalette.loading')}
                </Typography>
            )}

            {!prompting && !loading && commands.length === 0 && (
                <Typography
                    variant="body2"
                    sx={{
                        color: error ? 'error.main' : 'text.secondary',
                        px: 3,
                        pb: 3,
                    }}
                >
                    {emptyText}
                </Typography>
            )}

            {!prompting && commands.length > 0 && (
                <CommandList
                    rows={rows}
                    activeIndex={active}
                    showSection={!grouped}
                    onHover={setActiveIndex}
                    onChoose={choose}
                />
            )}
        </Dialog>
    );
};
