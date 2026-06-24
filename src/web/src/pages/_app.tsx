import '../../public/style.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CssBaseline from '@mui/material/CssBaseline';
import { Stack } from '@mui/material';
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { appWithTranslation } from 'next-i18next';
import { SocketProvider } from '../components/SocketProvider';
import { ConnectionProvider } from '../components/ConnectionProvider';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ToastProvider } from '../components/ToastProvider';
import { ContextMenuProvider } from '../components/ContextMenuProvider';
import { EntryClipboardProvider } from '../components/EntryClipboardProvider';
import { AuthGate } from '../components/AuthGate';
import { theme } from '../lib/theme';
import i18n from '../lib/i18n';
import { detectLanguage } from '../lib/detectLanguage';

function App({ Component, pageProps }: AppProps) {
    const router = useRouter();

    // Detect and apply the preferred language on mount. Done here rather than
    // in i18n.ts to avoid an SSR/hydration mismatch — the server always renders
    // in the fallback locale ('en'); this effect corrects it client-side.
    React.useEffect(() => {
        const lng = detectLanguage();
        if (i18n.language !== lng) i18n.changeLanguage(lng);
    }, []);
    // The login screen needs the theme but nothing else — it predates the
    // socket connection (which would otherwise fail until the user signs
    // in) and the connection banner (which has no socket to watch).
    const isLogin = router.pathname === '/login';

    return (
        <>
            <Head>
                <title>Caspar Manager</title>
                <meta
                    name="viewport"
                    content="initial-scale=1.0, width=device-width"
                />
            </Head>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {isLogin ? (
                    <Component {...pageProps} />
                ) : (
                    <AuthGate>
                        <SocketProvider>
                            <ConnectionProvider>
                                <ToastProvider>
                                    <ContextMenuProvider>
                                        <EntryClipboardProvider>
                                            <Stack
                                                direction="column"
                                                sx={{
                                                    height: '100vh',
                                                    width: '100%',
                                                }}
                                            >
                                                <ConnectionBanner />
                                                <Stack
                                                    sx={{
                                                        flex: 1,
                                                        minHeight: 0,
                                                    }}
                                                >
                                                    <Component {...pageProps} />
                                                </Stack>
                                            </Stack>
                                        </EntryClipboardProvider>
                                    </ContextMenuProvider>
                                </ToastProvider>
                            </ConnectionProvider>
                        </SocketProvider>
                    </AuthGate>
                )}
            </ThemeProvider>
        </>
    );
}

export default appWithTranslation(App);
