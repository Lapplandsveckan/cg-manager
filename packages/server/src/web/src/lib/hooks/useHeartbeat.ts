import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import type { NextRouter } from 'next/router';
import { noTryAsync } from 'no-try';
import type { ManagerApi } from '../api/api';
import { checkAuth } from '../auth';
import { useLatest } from './useLatest';

export type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

// Poll lazily while healthy; retry faster once a heartbeat fails.
const HEARTBEAT_INTERVAL_OK_MS = 5000;
const HEARTBEAT_INTERVAL_RETRY_MS = 1500;
const HEARTBEAT_TIMEOUT_MS = 3000;

// One failure -> subtle banner. Three in a row -> loud banner.
const RECONNECTING_THRESHOLD = 1;
const DISCONNECTED_THRESHOLD = 3;

// REPClient never redials a dropped socket and silently falls back to HTTP,
// so a healthy heartbeat can hide a dead websocket. Redial once it's been
// down this many ticks in a row (one tick of grace for the initial connect).
const WS_REDIAL_TICKS = 2;

async function checkAuthExpired(): Promise<boolean> {
    const status = await checkAuth();
    return !!status && status.enabled && !status.authenticated;
}

// REPClient's promise hangs forever on a dead websocket, so race it against
// a timeout; the timed-out request leaks a small, bounded entry in its map.
async function pingOnce(socket: ManagerApi): Promise<string | null> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), HEARTBEAT_TIMEOUT_MS);
    });

    const [err, res] = await noTryAsync(() =>
        Promise.race([socket.getApiVersion(), timeoutPromise]),
    );
    return err ? null : res;
}

class HeartbeatTracker {
    private fails = 0;
    private wsDownTicks = 0;
    private knownVersion: string | null = null;

    get connectionState(): ConnectionState {
        if (this.fails >= DISCONNECTED_THRESHOLD) return 'disconnected';
        if (this.fails >= RECONNECTING_THRESHOLD) return 'reconnecting';
        return 'connected';
    }

    get isFailing(): boolean {
        return this.fails >= RECONNECTING_THRESHOLD;
    }

    recordHealthy(version: string): boolean {
        const wasFailing = this.isFailing;
        this.fails = 0;
        this.wsDownTicks = 0;

        if (this.knownVersion === null) {
            this.knownVersion = version;
            return false;
        }
        return wasFailing && version !== this.knownVersion;
    }

    recordWsDown(): boolean {
        this.wsDownTicks += 1;
        const shouldRedial = this.wsDownTicks >= WS_REDIAL_TICKS;
        if (shouldRedial) this.fails += 1;
        return shouldRedial;
    }

    recordUnreachable() {
        this.wsDownTicks = 0;
        this.fails += 1;
    }
}

interface HeartbeatCallbacks {
    onStateChange: (state: ConnectionState) => void;
    onHeartbeat: (at: number) => void;
}

class HeartbeatSession {
    private readonly tracker = new HeartbeatTracker();
    private cancelled = false;
    private authCheckInFlight = false;
    private timer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private readonly socket: ManagerApi,
        private readonly routerRef: { current: NextRouter },
        private readonly callbacks: HeartbeatCallbacks,
    ) {}

    start = () => {
        this.tick();
    };

    stop = () => {
        this.cancelled = true;
        if (this.timer) clearTimeout(this.timer);
    };

    private tick = async () => {
        if (this.cancelled) return;
        const version = await pingOnce(this.socket);
        if (this.cancelled) return;

        if (version === null || !this.socket.wsConnected) {
            this.handleUnhealthyTick(version);
            this.scheduleNextTick(HEARTBEAT_INTERVAL_RETRY_MS);
            return;
        }

        const reloading = this.handleHealthyTick(version);
        if (!reloading) this.scheduleNextTick(HEARTBEAT_INTERVAL_OK_MS);
    };

    private scheduleNextTick(delayMs: number) {
        this.timer = setTimeout(this.tick, delayMs);
    }

    private handleHealthyTick(version: string): boolean {
        const shouldReload = this.tracker.recordHealthy(version);
        this.callbacks.onHeartbeat(Date.now());
        this.callbacks.onStateChange(this.tracker.connectionState);
        if (shouldReload) window.location.reload();
        return shouldReload;
    }

    private handleUnhealthyTick(version: string | null) {
        const reachable = version !== null;
        if (!reachable) this.tracker.recordUnreachable();

        const shouldRedial = reachable && this.tracker.recordWsDown();
        if (shouldRedial) void this.socket.connect();

        this.callbacks.onStateChange(this.tracker.connectionState);
        void this.redirectIfSessionExpired();
    }

    // Bounces to /login if the server is reachable but our session was wiped
    // (e.g. a manager restart). Re-checked on every failing tick, since a
    // restart outlasting the first failure means the first check ran while
    // the server was still unreachable.
    private async redirectIfSessionExpired() {
        if (
            !this.tracker.isFailing ||
            !this.routerRef.current.isReady ||
            this.authCheckInFlight
        )
            return;

        this.authCheckInFlight = true;
        const expired = await checkAuthExpired();
        this.authCheckInFlight = false;
        if (!expired || this.cancelled) return;

        const router = this.routerRef.current;
        router.replace(`/login?from=${encodeURIComponent(router.asPath)}`);
    }
}

export function useHeartbeat(socket: ManagerApi | null | undefined) {
    const routerRef = useLatest(useRouter());
    const [state, setState] = useState<ConnectionState>('connected');
    const [lastSeen, setLastSeen] = useState<number | null>(null);

    useEffect(() => {
        if (!socket) return;

        const session = new HeartbeatSession(socket, routerRef, {
            onStateChange: setState,
            onHeartbeat: setLastSeen,
        });
        session.start();

        return session.stop;
    }, [socket, routerRef]);

    return useMemo(() => ({ state, lastSeen }), [state, lastSeen]);
}
