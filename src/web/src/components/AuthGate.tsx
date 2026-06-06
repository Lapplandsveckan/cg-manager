import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {Box, CircularProgress} from '@mui/material';
import {noTryAsync} from 'no-try';

interface AuthStatus {
    enabled: boolean;
    authenticated: boolean;
}

async function checkAuth(): Promise<AuthStatus | null> {
    const [fetchErr, resp] = await noTryAsync(
        () => fetch('/api/auth/check', {credentials: 'same-origin'}),
    );
    if (fetchErr || !resp.ok) return null;
    const [jsonErr, json] = await noTryAsync(() => resp.json());
    if (jsonErr) return null;
    return json as AuthStatus;
}

/**
 * Gate the app behind the server's auth status. On mount, hits
 * `/api/auth/check`:
 *  - auth disabled (no password configured) → render children immediately.
 *  - authenticated → render children.
 *  - not authenticated → redirect to /login, preserving the current path as
 *    `?from=…` so the login page can bounce the user back after sign-in.
 *
 * Wrap the *outside* of SocketProvider — the WebSocket upgrade is gated by
 * the same cookie, so we don't want it firing before we know we're allowed
 * in (it would briefly show ConnectionBanner as 'disconnected').
 */
export const AuthGate: React.FC<{children: React.ReactNode}> = ({children}) => {
    const router = useRouter();
    const [status, setStatus] = useState<AuthStatus | null>(null);

    useEffect(() => {
        let cancelled = false;
        checkAuth().then((s) => {
            if (!cancelled) setStatus(s);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!status) return;
        // On dynamic routes (e.g. `/play/[id]`) Next.js' automatic static
        // optimization leaves `router.asPath` as the route *pattern* until
        // `router.isReady` flips. Capturing too early gave us a `from=`
        // value of `/play/[id]` literally, which then failed to navigate
        // back after sign-in. Wait until the router has hydrated.
        if (!router.isReady) return;
        if (status.enabled && !status.authenticated)
            router.replace(`/login?from=${encodeURIComponent(router.asPath)}`);
    }, [status, router, router.isReady, router.asPath]);

    // First paint while we're still checking — keeps the layout from flashing
    // either the login screen or the app before we know which it should be.
    if (status?.authenticated) return <>{children}</>;
    if (status && !status.enabled) return <>{children}</>;

    return (
        <Box
            sx={{
                display: 'flex',
                height: '100vh',
                width: '100%',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <CircularProgress size={28} />
        </Box>
    );
};
