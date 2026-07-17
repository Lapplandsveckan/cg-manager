import { EventEmitter } from 'events';
import type {
    ServiceHandle,
    ContributionHandle,
    Contribution,
} from '@lappis/cg-manager';
import { Logger } from '../../util/log';
import { UUID } from '../../util/uuid';

interface RegisteredService {
    impl: unknown;
    owner: string;
}

interface ServiceAwaiter {
    owner: string;
    resolve: (impl: unknown) => void;
}

// Named, in-process cross-plugin communication: services (consumer calls
// provider) and contributions (consumer pushes into a provider-owned point).
// Both are owner-scoped so `unregisterOwner` (called on plugin disable, see
// PluginManager._applyDisable) tears everything a plugin registered down in
// one call — same shape as CompanionRegistry.
export class PluginInterop extends EventEmitter {
    private _services = new Map<string, RegisteredService>(); // name -> service
    private _contributions = new Map<string, Contribution[]>(); // point -> contributions
    private _awaiters = new Map<string, ServiceAwaiter[]>();

    // ── Services ────────────────────────────────────────────────────────────

    public provideService<T>(
        name: string,
        impl: T,
        owner: string,
    ): ServiceHandle<T> {
        const existing = this._services.get(name);
        if (existing && existing.owner !== owner) {
            Logger.scope('PluginInterop').warn(
                `Service "${name}" already provided by "${existing.owner}" — overwritten by "${owner}"`,
            );
        }
        this._services.set(name, { impl, owner });
        this._resolveAwaiters(name, impl);
        this.emit('service-change', name);

        return {
            update: newImpl => {
                if (this._services.get(name)?.owner !== owner) return;
                this._services.set(name, { impl: newImpl, owner });
                this.emit('service-change', name);
            },
            remove: () => {
                if (this._services.get(name)?.owner !== owner) return;
                this._services.delete(name);
                this.emit('service-change', name);
            },
        };
    }

    public getService<T>(name: string): T | null {
        return (this._services.get(name)?.impl as T) ?? null;
    }

    // Tagged with the awaiting plugin's name so `unregisterOwner` can drop
    // the resolver if that plugin is disabled before the service ever
    // appears — otherwise the closure (and whatever it captured) would sit
    // in `_awaiters` forever.
    public awaitService<T>(name: string, owner: string): Promise<T> {
        if (this._services.has(name))
            return Promise.resolve(this.getService<T>(name));

        return new Promise(resolve => {
            const waiters = this._awaiters.get(name) ?? [];
            waiters.push({
                owner,
                resolve: resolve as (impl: unknown) => void,
            });
            this._awaiters.set(name, waiters);
        });
    }

    private _resolveAwaiters(name: string, impl: unknown) {
        const waiters = this._awaiters.get(name);
        if (!waiters) return;
        this._awaiters.delete(name);
        for (const { resolve } of waiters) resolve(impl);
    }

    public onServiceChange(handler: (name: string) => void) {
        this.on('service-change', handler);
    }

    public offServiceChange(handler: (name: string) => void) {
        this.off('service-change', handler);
    }

    // ── Contributions ───────────────────────────────────────────────────────

    public contribute<T>(
        point: string,
        value: T,
        owner: string,
    ): ContributionHandle<T> {
        const id = UUID.generate();
        const list = this._contributions.get(point) ?? [];
        list.push({ owner, id, value });
        this._contributions.set(point, list);
        this.emit(`contributions-change:${point}`, list);

        return {
            update: newValue => {
                const current = this._contributions.get(point) ?? [];
                const entry = current.find(c => c.id === id);
                if (!entry) return;
                entry.value = newValue;
                this.emit(`contributions-change:${point}`, current);
            },
            remove: () => {
                const current = this._contributions.get(point);
                if (!current) return;
                const next = current.filter(c => c.id !== id);
                this._contributions.set(point, next);
                this.emit(`contributions-change:${point}`, next);
            },
        };
    }

    public getContributions<T>(point: string): Contribution<T>[] {
        return [
            ...((this._contributions.get(point) as Contribution<T>[]) ?? []),
        ];
    }

    public onContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ) {
        this.on(`contributions-change:${point}`, handler);
    }

    public offContributionsChange(
        point: string,
        handler: (contributions: Contribution[]) => void,
    ) {
        this.off(`contributions-change:${point}`, handler);
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────

    public unregisterOwner(owner: string) {
        for (const [name, service] of this._services) {
            if (service.owner !== owner) continue;
            this._services.delete(name);
            this.emit('service-change', name);
        }

        for (const [point, list] of this._contributions) {
            if (!list.some(c => c.owner === owner)) continue;
            const next = list.filter(c => c.owner !== owner);
            this._contributions.set(point, next);
            this.emit(`contributions-change:${point}`, next);
        }

        // Drop pending awaitService() resolvers for a plugin that's gone —
        // otherwise they sit in `_awaiters` forever, never resolving or GC'd.
        for (const [name, waiters] of this._awaiters) {
            if (!waiters.some(w => w.owner === owner)) continue;
            const remaining = waiters.filter(w => w.owner !== owner);
            if (remaining.length) this._awaiters.set(name, remaining);
            else this._awaiters.delete(name);
        }
    }
}
