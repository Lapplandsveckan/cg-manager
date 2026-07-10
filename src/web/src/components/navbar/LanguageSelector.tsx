import { Box, IconButton, Menu, MenuItem, Tooltip } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'next-i18next';
import LanguageIcon from '@mui/icons-material/Language';
import {
    SUPPORTED_LANGUAGES,
    type SupportedLanguage,
    setStoredLanguage,
} from '../../lib/detectLanguage';

export const LanguageSelector: React.FC = () => {
    const { t, i18n } = useTranslation('common');
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [current, setCurrent] = useState<SupportedLanguage>(
        (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
            ? (i18n.language as SupportedLanguage)
            : 'en',
    );

    const open = (e: React.MouseEvent<HTMLElement>) =>
        setAnchor(e.currentTarget);
    const close = () => setAnchor(null);

    const select = (lng: SupportedLanguage) => {
        i18n.changeLanguage(lng);
        setStoredLanguage(lng);
        setCurrent(lng);
        close();
    };

    return (
        <Box>
            <Tooltip title={t('language.label')} placement="right">
                <IconButton
                    size="small"
                    onClick={open}
                    sx={{ color: 'text.secondary' }}
                >
                    <LanguageIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={close}
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                {SUPPORTED_LANGUAGES.map(lng => (
                    <MenuItem
                        key={lng}
                        selected={lng === current}
                        onClick={() => select(lng)}
                    >
                        {t(`language.${lng}`)}
                    </MenuItem>
                ))}
            </Menu>
        </Box>
    );
};
