import '../../public/style.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import CssBaseline from '@mui/material/CssBaseline';
import { Stack } from '@mui/material';
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';
import { QueryClientProvider } from '@tanstack/react-query';
// Import first so the i18next singleton initialises before any
// useTranslation() call in a child component resolves against it.
import i18n from '../lib/i18n';
import { reportClientError } from '../lib/reportClientError';
import { queryClient } from '../lib/query/client';
import { SocketProvider } from '../components/SocketProvider';
import { ConnectionProvider } from '../components/ConnectionProvider';
import { QuerySync } from '../components/QuerySync';
import { UndoInvalidationSync } from '../components/UndoInvalidationSync';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { ToastProvider } from '../components/ToastProvider';
import { UndoProvider } from '../components/UndoProvider';
import { ContextMenuProvider } from '../components/ContextMenuProvider';
import { RouteInspectorProvider } from '../components/routes/RouteInspectorProvider';
import { PluginContextMenuMounts } from '../components/PluginContextMenuMounts';
import { EntryClipboardProvider } from '../components/EntryClipboardProvider';
import { AuthGate } from '../components/AuthGate';
import { theme } from '../lib/theme';
import { detectLanguage } from '../lib/detectLanguage';
import '../lib/api/globals';

const appCrashFallback = (
    <div style={{ padding: 32 }}>
        Something went wrong. Reload to try again.
    </div>
);

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
                <QueryClientProvider client={queryClient}>
                    {isLogin ? (
                        <ErrorBoundary
                            fallback={appCrashFallback}
                            onError={(e, i) => {
                                // eslint-disable-next-line no-console -- devtools half of the report; reportClientError below sends the other half
                                console.error('[app:login]', e, i);
                                const err = e as Error;
                                reportClientError({
                                    source: 'app:login',
                                    message: err.message,
                                    stack: err.stack,
                                    componentStack: i.componentStack,
                                });
                            }}
                        >
                            <Component {...pageProps} />
                        </ErrorBoundary>
                    ) : (
                        <AuthGate>
                            <SocketProvider>
                                <ConnectionProvider>
                                    <QuerySync />
                                    <ToastProvider>
                                        <UndoProvider>
                                            <UndoInvalidationSync />
                                            <ContextMenuProvider>
                                                <RouteInspectorProvider>
                                                    <PluginContextMenuMounts />
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
                                                                <ErrorBoundary
                                                                    fallback={
                                                                        appCrashFallback
                                                                    }
                                                                    onError={(
                                                                        e,
                                                                        i,
                                                                    ) => {
                                                                        // eslint-disable-next-line no-console -- devtools half of the report; reportClientError below sends the other half
                                                                        console.error(
                                                                            '[app:page]',
                                                                            e,
                                                                            i,
                                                                        );
                                                                        const err =
                                                                            e as Error;
                                                                        reportClientError(
                                                                            {
                                                                                source: 'app:page',
                                                                                message:
                                                                                    err.message,
                                                                                stack: err.stack,
                                                                                componentStack:
                                                                                    i.componentStack,
                                                                            },
                                                                        );
                                                                    }}
                                                                >
                                                                    <Component
                                                                        {...pageProps}
                                                                    />
                                                                </ErrorBoundary>
                                                            </Stack>
                                                        </Stack>
                                                    </EntryClipboardProvider>
                                                </RouteInspectorProvider>
                                            </ContextMenuProvider>
                                        </UndoProvider>
                                    </ToastProvider>
                                </ConnectionProvider>
                            </SocketProvider>
                        </AuthGate>
                    )}
                </QueryClientProvider>
            </ThemeProvider>
        </>
    );
}

export default App;
