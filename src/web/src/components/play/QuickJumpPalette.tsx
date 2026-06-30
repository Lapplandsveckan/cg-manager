import {
    Dialog,
    InputAdornment,
    List,
    ListItemButton,
    ListItemText,
    TextField,
    Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import type { Rundown } from '../../hooks/useRundowns';

const MAX_RESULTS = 8;

interface QuickJumpPaletteProps {
    rundowns: Rundown[];
    open: boolean;
    onClose: () => void;
    onSelect: (id: string) => void;
}

export const QuickJumpPalette: React.FC<QuickJumpPaletteProps> = ({
    rundowns,
    open,
    onClose,
    onSelect,
}) => {
    const { t } = useTranslation('common');
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (open) {
            setQuery('');
            setActiveIndex(0);
        }
    }, [open]);

    const matches = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const filtered = needle
            ? rundowns.filter(rundown =>
                  (rundown.name || '').toLowerCase().includes(needle),
              )
            : rundowns;
        return filtered.slice(0, MAX_RESULTS);
    }, [rundowns, query]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="sm"
            sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
            PaperProps={{ sx: { mt: 10 } }}
        >
            <TextField
                autoFocus
                fullWidth
                value={query}
                placeholder={t('playPage.quickJump.placeholder')}
                onChange={e => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                }}
                onKeyDown={e => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActiveIndex(i =>
                            matches.length ? (i + 1) % matches.length : 0,
                        );
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActiveIndex(i =>
                            matches.length
                                ? (i - 1 + matches.length) % matches.length
                                : 0,
                        );
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const match = matches[activeIndex];
                        if (match) onSelect(match.id);
                    } else if (e.key === 'Escape') {
                        onClose();
                    }
                }}
                InputProps={{
                    startAdornment: (
                        <InputAdornment position="start">
                            <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                    ),
                }}
                sx={{ p: 2 }}
            />

            {matches.length === 0 ? (
                <Typography
                    variant="body2"
                    sx={{ color: 'text.secondary', px: 3, pb: 3 }}
                >
                    {t('playPage.quickJump.empty')}
                </Typography>
            ) : (
                <List dense sx={{ pb: 1 }}>
                    {matches.map((rundown, index) => {
                        const itemCount = rundown.items?.length ?? 0;
                        return (
                            <ListItemButton
                                key={rundown.id}
                                selected={index === activeIndex}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => onSelect(rundown.id)}
                            >
                                <ListItemText
                                    primary={
                                        rundown.name ||
                                        t('playPage.unnamedRundown')
                                    }
                                    secondary={
                                        itemCount === 0
                                            ? t('playPage.itemCount.empty')
                                            : t('playPage.itemCount.count', {
                                                  count: itemCount,
                                              })
                                    }
                                />
                            </ListItemButton>
                        );
                    })}
                </List>
            )}
        </Dialog>
    );
};
