import { createTheme, alpha } from '@mui/material/styles';

// Cool-technical dark palette, leaning toward broadcast tooling (OBS / vMix).
// Neutral-cool surfaces, a desaturated copper accent for primary actions
// (toned down so it reads as functional, not decorative), cool-white text.
// Surface tiers are solid ramps rather than MUI's elevation overlays, so
// cards stay legible without translucent washes.
const surface = {
    base: '#18191c',
    paper: '#232428',
    elevated: '#2d2e33',
    raised: '#37383d',
};

const accent = {
    primary: '#c98049', // copper — toned amber
    primaryDark: '#a06234',
    primaryLight: '#d99a6b',

    secondary: '#5e8fa1', // muted steel-blue — used sparingly
};

const TEXT_WHITE = '#e8eaed';
const text = {
    primary: TEXT_WHITE,
    secondary: alpha(TEXT_WHITE, 0.65),
    disabled: alpha(TEXT_WHITE, 0.4),
};

export const palette = {
    mode: 'dark' as const,

    background: {
        default: surface.base,
        paper: surface.paper,
    },

    primary: {
        main: accent.primary,
        dark: accent.primaryDark,
        light: accent.primaryLight,
        contrastText: surface.base,
    },
    secondary: {
        main: accent.secondary,
        contrastText: surface.base,
    },

    text,
    divider: alpha(TEXT_WHITE, 0.07),

    // Custom slots — read via theme.palette.surface.elevated etc.
    surface,
} as const;

export const theme = createTheme({
    palette,
    shape: {
        borderRadius: 8,
    },
    typography: {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
        }, // 32
        h2: {
            fontSize: '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
        }, // 24
        h3: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.3 }, // 20
        h4: { fontSize: '1.125rem', fontWeight: 500, lineHeight: 1.35 }, // 18
        h5: { fontSize: '1rem', fontWeight: 500, lineHeight: 1.4 }, // 16
        h6: {
            fontSize: '0.75rem',
            fontWeight: 600,
            lineHeight: 1.4,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
        }, // 12 — used as section labels
        body1: { fontSize: '0.875rem', lineHeight: 1.55 }, // 14
        body2: { fontSize: '0.8125rem', lineHeight: 1.5 }, // 13
        caption: {
            fontSize: '0.6875rem',
            lineHeight: 1.4,
            color: text.secondary,
        }, // 11
        button: { textTransform: 'none', fontWeight: 500 },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    backgroundColor: surface.base,
                    color: text.primary,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none', // disable MUI's elevation overlay; we use solid surface tiers
                    backgroundColor: surface.paper,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: surface.paper,
                    backgroundImage: 'none',
                    border: `1px solid ${alpha(TEXT_WHITE, 0.06)}`,
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    padding: '6px 14px',
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: surface.raised,
                    color: text.primary,
                    fontSize: '0.75rem',
                    border: `1px solid ${alpha(TEXT_WHITE, 0.08)}`,
                },
            },
        },
    },
});

// Module augmentation so consumers can read theme.palette.surface.elevated etc.
declare module '@mui/material/styles' {
    interface Palette {
        surface: typeof surface;
    }
    interface PaletteOptions {
        surface?: typeof surface;
    }
}
