import '../../public/style.css';
import type {AppProps} from 'next/app';
import Head from 'next/head';
import {SocketProvider} from '../components/SocketProvider';
import {ConnectionProvider} from '../components/ConnectionProvider';
import {ConnectionBanner} from '../components/ConnectionBanner';
import CssBaseline from '@mui/material/CssBaseline';
import {Stack} from '@mui/material';
import React from 'react';
import {ThemeProvider} from '@mui/material/styles';
import {theme} from '../lib/theme';

function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <title>Caspar Manager</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>
            <SocketProvider>
                <ConnectionProvider>
                    <ThemeProvider theme={theme}>
                        <CssBaseline />
                        <Stack direction="column" sx={{height: '100vh', width: '100%'}}>
                            <ConnectionBanner />
                            <Stack sx={{flex: 1, minHeight: 0}}>
                                <Component {...pageProps} />
                            </Stack>
                        </Stack>
                    </ThemeProvider>
                </ConnectionProvider>
            </SocketProvider>
        </>
    );
}

export default App;