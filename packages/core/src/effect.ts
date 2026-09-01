import { EventEmitter } from 'events';
import { randomUUID as uuid } from 'crypto';
import { type Transform } from './transform';
import { type EffectGroup, type Layer } from './layers';
import { type Command } from './command';

export abstract class Effect extends EventEmitter {
    private _active: boolean = false;
    private _disposed: boolean = false;
    public readonly id: string = uuid();
    public get active() {
        return this._active;
    }

    protected transform: Transform;
    public getTransform() {
        return this.transform;
    }

    public setTransform(transform: Transform) {
        this.transform = transform;
        this.applyTransform();
    }

    // Override this method if you don't want to apply the transform
    protected applyTransform() {
        if (!this.active) return;
        if (!this.transform) return;

        for (const layer of this.layers)
            this.executor.execute(this.transform.getCommand().allocate(layer));
    }

    protected effectGroup: EffectGroup;
    public get group() {
        return this.effectGroup;
    }

    public get executor() {
        return this.group.channel.executor;
    }

    protected constructor(effectGroup: EffectGroup) {
        super();
        this.effectGroup = effectGroup;
        this.group.addEffect(this);
    }

    // Return type stays `any` (not `boolean`, though every implementation
    // returns one): public API, and narrowing it would break a subclass that
    // overrides with a different return type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public activate(): any {
        if (this._disposed) return false;
        if (this.active) return false;
        this._active = true;

        this.executor.executeAllocations();
        this.applyTransform();

        return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public deactivate(): any {
        if (!this.active) return false;
        this._active = false;

        return true;
    }

    public dispose() {
        if (this._disposed) return;
        this._disposed = true;

        this.deactivate();
        this.deallocateLayers(this.layers);
        this.executor.executeAllocations();

        this.group.removeEffect(this);
        this.effectGroup = null;
        this.transform = null;

        this.removeAllListeners();
    }

    protected layers: Layer[] = [];
    public getLayers() {
        return this.layers;
    }

    protected allocateLayers(count = 1) {
        const index = this.group.getEffectIndex(this);
        const layers = this.group.channel.allocateLayers({ count, index });
        this.layers.push(...layers);

        for (const layer of layers) layer.setEffect(this);
        return layers;
    }

    protected deallocateLayers(layers: Layer[]) {
        layers = layers.slice();

        for (const layer of layers) {
            layer.setEffect(null);

            const index = this.layers.indexOf(layer);
            if (index >= 0) this.layers.splice(index, 1);
        }

        this.group.channel.deallocateLayers(layers);
    }

    public updatePositions(): Command[] {
        return [];
    }

    public getName() {
        return this.constructor.name;
    }

    public getMetadata() {
        return {};
    }

    public toJSON() {
        return {
            id: this.id,
            type: this.getName(),
            active: this.active,
            metadata: this.getMetadata(),
            layers: this.layers.map(layer => layer.toJSON()),
        };
    }
}

// `options` stays `Record<string, any>`: each effect type defines its own
// options shape, so this is genuinely heterogeneous — not a missing type.
export type EffectConstructor = (
    group: EffectGroup,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: Record<string, any>,
) => Effect;
export class EffectRegistry {
    private effects: Map<string, EffectConstructor> = new Map();

    public register(name: string, effect: EffectConstructor) {
        this.effects.set(name, effect);
    }

    public unregister(name: string) {
        this.effects.delete(name);
    }

    public get(name: string) {
        return this.effects.get(name);
    }

    public create(
        name: string,
        group: EffectGroup,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options: Record<string, any>,
    ) {
        const effect = this.get(name);
        if (!effect) return null;

        return effect(group, options);
    }
}
