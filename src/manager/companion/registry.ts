import { noTry } from 'no-try';
import type {
    ActionDefinition,
    ActionHandle,
    FeedbackDefinition,
    FeedbackHandle,
    InvokeContext,
    OptionValues,
    CompanionStyle,
} from '@lappis/cg-manager';
import { CasparManager } from '../index';

// ── Serialized types (handler/evaluate functions stripped) ──────────────────

export interface SerializedAction {
    plugin: string;
    id: string;
    name: string;
    description?: string;
    options?: ActionDefinition['options'];
}

export interface SerializedFeedback {
    plugin: string;
    id: string;
    name: string;
    description?: string;
    type: FeedbackDefinition['type'];
    options?: FeedbackDefinition['options'];
    defaultStyle?: FeedbackDefinition['defaultStyle'];
}

// ── Internal records ────────────────────────────────────────────────────────

interface RegisteredAction {
    def: ActionDefinition;
    owner: string;
}

interface RegisteredFeedback {
    def: FeedbackDefinition;
    owner: string;
}

interface FeedbackSub {
    key: string; // `${plugin}:${id}`
    options: OptionValues;
    lastValue: boolean | CompanionStyle | null;
}

// ── Registry ────────────────────────────────────────────────────────────────

export class CompanionRegistry {
    private _actions = new Map<string, RegisteredAction>(); // key `${plugin}:${id}`
    private _feedbacks = new Map<string, RegisteredFeedback>(); // key `${plugin}:${id}`
    private _subs = new Map<string, FeedbackSub>(); // instanceId → sub

    private _key(plugin: string, id: string) {
        return `${plugin}:${id}`;
    }

    private _broadcast() {
        const manager = CasparManager.getManager();
        manager.server.broadcast(
            'companion/definitions',
            'UPDATE',
            this.listDefinitions(),
        );
    }

    // ── Actions ─────────────────────────────────────────────────────────────

    public registerAction(def: ActionDefinition, owner: string): ActionHandle {
        const key = this._key(owner, def.id);
        this._actions.set(key, { def: { ...def }, owner });
        this._broadcast();

        const handle: ActionHandle = {
            get id() {
                return def.id;
            },
            update: patch => {
                const record = this._actions.get(key);
                if (!record) return;
                Object.assign(record.def, patch);
                this._broadcast();
            },
            remove: () => {
                this._actions.delete(key);
                this._broadcast();
            },
        };
        return handle;
    }

    // ── Feedbacks ───────────────────────────────────────────────────────────

    public registerFeedback(
        def: FeedbackDefinition,
        owner: string,
    ): FeedbackHandle {
        const key = this._key(owner, def.id);
        this._feedbacks.set(key, { def: { ...def }, owner });
        this._broadcast();

        const handle: FeedbackHandle = {
            get id() {
                return def.id;
            },
            update: patch => {
                const record = this._feedbacks.get(key);
                if (!record) return;
                Object.assign(record.def, patch);
                this._broadcast();
                // Re-eval all subs so Companion gets the new evaluate fn's results.
                this.invalidate(owner, def.id);
            },
            invalidate: () => this.invalidate(owner, def.id),
            remove: () => {
                // Drop all subscriptions for this feedback.
                for (const [instId, sub] of this._subs) {
                    if (sub.key === key) this._subs.delete(instId);
                }
                this._feedbacks.delete(key);
                this._broadcast();
            },
        };
        return handle;
    }

    // ── Invocation & subscription ────────────────────────────────────────────

    public async invoke(
        plugin: string,
        id: string,
        options: OptionValues,
        ctx: InvokeContext,
    ) {
        const key = this._key(plugin, id);
        const record = this._actions.get(key);
        if (!record) return;
        const [err] = await noTry(() => record.def.handler(options, ctx));
        if (err) CasparManager.getManager().emit('companion-error', err);
    }

    public subscribe(
        instanceId: string,
        plugin: string,
        id: string,
        options: OptionValues,
    ) {
        const key = this._key(plugin, id);
        const record = this._feedbacks.get(key);
        if (!record) return;

        const [, value] = noTry(() => record.def.evaluate(options));
        const coerced = value ?? (record.def.type === 'boolean' ? false : {});
        this._subs.set(instanceId, { key, options, lastValue: coerced });
        this._pushFeedback(instanceId, coerced);
    }

    public unsubscribe(instanceId: string) {
        this._subs.delete(instanceId);
    }

    public invalidate(plugin: string, id: string) {
        const key = this._key(plugin, id);
        const record = this._feedbacks.get(key);
        if (!record) return;

        for (const [instanceId, sub] of this._subs) {
            if (sub.key !== key) continue;
            const [, value] = noTry(() => record.def.evaluate(sub.options));
            const coerced =
                value ?? (record.def.type === 'boolean' ? false : {});

            // Only push if the value changed (shallow compare for primitives; always push objects).
            if (typeof coerced !== 'object' && coerced === sub.lastValue)
                continue;
            sub.lastValue = coerced;
            this._pushFeedback(instanceId, coerced);
        }
    }

    private _pushFeedback(instanceId: string, value: boolean | CompanionStyle) {
        CasparManager.getManager().server.broadcast(
            'companion/feedback',
            'UPDATE',
            { instanceId, value },
        );
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────

    public unregisterOwner(owner: string) {
        let changed = false;

        for (const [key, record] of this._actions) {
            if (record.owner !== owner) continue;
            this._actions.delete(key);
            changed = true;
        }

        const deadKeys = new Set<string>();
        for (const [key, record] of this._feedbacks) {
            if (record.owner !== owner) continue;
            this._feedbacks.delete(key);
            deadKeys.add(key);
            changed = true;
        }

        // Drop subscriptions for removed feedbacks.
        for (const [instId, sub] of this._subs) {
            if (deadKeys.has(sub.key)) this._subs.delete(instId);
        }

        if (changed) this._broadcast();
    }

    // ── Query ────────────────────────────────────────────────────────────────

    public listDefinitions(): {
        actions: SerializedAction[];
        feedbacks: SerializedFeedback[];
    } {
        const actions: SerializedAction[] = [];
        for (const [, { def, owner }] of this._actions) {
            actions.push({
                plugin: owner,
                id: def.id,
                name: def.name,
                description: def.description,
                options: def.options,
            });
        }

        const feedbacks: SerializedFeedback[] = [];
        for (const [, { def, owner }] of this._feedbacks) {
            feedbacks.push({
                plugin: owner,
                id: def.id,
                name: def.name,
                description: def.description,
                type: def.type,
                options: def.options,
                defaultStyle: def.defaultStyle,
            });
        }

        return { actions, feedbacks };
    }
}
