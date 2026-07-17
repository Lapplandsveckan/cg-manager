import { type CasparPlugin } from '@lappis/cg-manager';

/** Tracks declared plugin dependencies and resolves enable order / gating.
 *  Kept separate from `PluginManager` so dependency bookkeeping doesn't
 *  crowd out the enable/disable lifecycle it's mixed into. */
export class PluginDependencyResolver {
    /** pluginName -> hard dependency names (must be enabled first). */
    private _dependencies = new Map<string, string[]>();
    /** pluginName -> soft dependency names (ordering only, never blocks). */
    private _optionalDependencies = new Map<string, string[]>();
    /** Plugins currently blocked solely because a hard dependency isn't enabled. */
    private _blocked = new Set<string>();

    public capture(name: string, dependencies: string[], optional: string[]) {
        if (dependencies.length) this._dependencies.set(name, dependencies);
        if (optional.length) this._optionalDependencies.set(name, optional);
    }

    public forget(name: string) {
        this._dependencies.delete(name);
        this._optionalDependencies.delete(name);
        this._blocked.delete(name);
    }

    public dependenciesOf(name: string): string[] {
        return this._dependencies.get(name) ?? [];
    }

    public isBlocked(name: string) {
        return this._blocked.has(name);
    }

    /** Force-clear the blocked flag, e.g. when the host bypasses gating via
     *  an explicit user-triggered enable regardless of unmet dependencies. */
    public clearBlocked(name: string) {
        this._blocked.delete(name);
    }

    public blockedNames(): string[] {
        return [...this._blocked];
    }

    /** Hard dependencies of `name` that aren't currently enabled (or don't exist). */
    public missing(name: string, plugins: CasparPlugin[]): string[] {
        return this.dependenciesOf(name).filter(dep => {
            const p = plugins.find(pp => pp.pluginName === dep);
            return !p?.['_enabled'];
        });
    }

    /** Same as `missing`, but also updates the blocked set as a side effect. */
    public evaluate(name: string, plugins: CasparPlugin[]): string[] {
        const missing = this.missing(name, plugins);
        if (missing.length) this._blocked.add(name);
        else this._blocked.delete(name);
        return missing;
    }

    /** Orders plugins so a dependency (hard or soft) always precedes its
     *  dependents. Plugins involved in a cycle keep their original relative
     *  order — they'll simply stay dependency-blocked, since neither side
     *  of the cycle can ever be enabled first. Returns the cyclic subset
     *  separately so the caller can log it. */
    public order(plugins: CasparPlugin[]): {
        ordered: CasparPlugin[];
        cyclic: CasparPlugin[];
    } {
        const byName = new Map(plugins.map(p => [p.pluginName, p]));
        const indegree = new Map<string, number>();
        const dependents = new Map<string, string[]>(); // dep -> plugins waiting on it
        for (const p of plugins) indegree.set(p.pluginName, 0);

        for (const p of plugins) {
            const deps = [
                ...this.dependenciesOf(p.pluginName),
                ...(this._optionalDependencies.get(p.pluginName) ?? []),
            ];
            for (const dep of deps) {
                if (!byName.has(dep)) continue;
                dependents.set(dep, [
                    ...(dependents.get(dep) ?? []),
                    p.pluginName,
                ]);
                indegree.set(
                    p.pluginName,
                    (indegree.get(p.pluginName) ?? 0) + 1,
                );
            }
        }

        const queue = plugins.filter(p => indegree.get(p.pluginName) === 0);
        const ordered: CasparPlugin[] = [];
        const seen = new Set<string>();
        while (queue.length) {
            const p = queue.shift();
            if (seen.has(p.pluginName)) continue;
            seen.add(p.pluginName);
            ordered.push(p);
            for (const nextName of dependents.get(p.pluginName) ?? []) {
                const remaining = (indegree.get(nextName) ?? 0) - 1;
                indegree.set(nextName, remaining);
                if (remaining === 0) queue.push(byName.get(nextName));
            }
        }

        const cyclic = plugins.filter(p => !seen.has(p.pluginName));
        return { ordered: [...ordered, ...cyclic], cyclic };
    }

    /** Every currently-enabled plugin that (transitively) hard-depends on
     *  `name`, marked blocked as they're discovered. Caller is responsible
     *  for actually disabling them (in the returned order). */
    public cascadeBlocked(
        name: string,
        plugins: CasparPlugin[],
    ): CasparPlugin[] {
        const visited = new Set([name]);
        const result: CasparPlugin[] = [];
        const queue = [name];

        while (queue.length) {
            const current = queue.shift();
            for (const p of plugins) {
                if (!p['_enabled'] || visited.has(p.pluginName)) continue;
                if (!this.dependenciesOf(p.pluginName).includes(current))
                    continue;

                visited.add(p.pluginName);
                this._blocked.add(p.pluginName);
                result.push(p);
                queue.push(p.pluginName);
            }
        }

        return result;
    }
}
