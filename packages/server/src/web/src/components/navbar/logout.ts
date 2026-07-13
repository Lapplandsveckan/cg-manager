import { noTryAsync } from 'no-try';

export async function logout() {
    await noTryAsync(() =>
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
        }),
    );
    // Hard reload so any in-memory state (socket, caches) is dropped — the
    // AuthGate on the next paint will redirect to /login.
    window.location.href = '/login';
}
