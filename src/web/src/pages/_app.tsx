import '../../public/style.css';
import type {AppProps} from 'next/app';
import Head from 'next/head';
import {SocketProvider} from '../components/SocketProvider';
import CssBaseline from '@mui/material/CssBaseline';
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
            <CssBaseline />
            <SocketProvider>
                <ThemeProvider theme={theme}>
                    <CssBaseline />
                    <Component {...pageProps} />
                </ThemeProvider>
            </SocketProvider>
        </>
    );
}

export default App;