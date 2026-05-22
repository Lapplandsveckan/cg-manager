import '../../public/style.css';
import type {AppProps} from 'next/app';
import Head from 'next/head';
import {useRouter} from 'next/router';
import {SocketProvider} from '../components/SocketProvider';
import {ConnectionProvider} from '../components/ConnectionProvider';
import {ConnectionBanner} from '../components/ConnectionBanner';
import {AuthGate} from '../components/AuthGate';
import CssBaseline from '@mui/material/CssBaseline';
import {Stack} from '@mui/material';
import React from 'react';
import {ThemeProvider} from '@mui/material/styles';
import {theme} from '../lib/theme';

function App({ Component, pageProps }: AppProps) {
    const router = useRouter();
    // The login screen needs the theme but nothing else — it predates the
    // socket connection (which would otherwise fail until the user signs
    // in) and the connection banner (which has no socket to watch).
    const isLogin = router.pathname === '/login';

    return (
        <>
            <Head>
                <title>Caspar Manager</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {isLogin ? (
                    <Component {...pageProps} />
                ) : (
                    <AuthGate>
                        <SocketProvider>
                            <ConnectionProvider>
                                <Stack direction="column" sx={{height: '100vh', width: '100%'}}>
                                    <ConnectionBanner />
                                    <Stack sx={{flex: 1, minHeight: 0}}>
                                        <Component {...pageProps} />
                                    </Stack>
                                </Stack>
                            </ConnectionProvider>
                        </SocketProvider>
                    </AuthGate>
                )}
            </ThemeProvider>
        </>
    );
}

export default App;