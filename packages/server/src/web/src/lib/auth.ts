import { noTryAsync } from 'no-try';

export interface AuthStatus {
    enabled: boolean;
    authenticated: boolean;
}

export async function checkAuth(): Promise<AuthStatus | null> {
    const [fetchErr, resp] = await noTryAsync(() =>
        fetch('/api/auth/check', { credentials: 'same-origin' }),
    );
    if (fetchErr || !resp.ok) return null;
    const [jsonErr, json] = await noTryAsync(() => resp.json());
    if (jsonErr || !json) return null;
    return json as AuthStatus;
}
