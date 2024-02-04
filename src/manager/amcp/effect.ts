import {EffectGroup, Layer} from './layers';

export abstract class Effect {
    private _active: boolean = false;
    private _disposed: boolean = false;
    protected get active() {
        return this._active;
    }

    protected effectGroup: EffectGroup;
    public get group() {
        return this.effectGroup;
    }

    public get executor() {
        return this.group.channel.executor;
    }

    protected constructor(effectGroup: EffectGroup) {
        this.effectGroup = effectGroup;
        this.group.addEffect(this); // Maybe delay this until the effect is activated?
    }

    public activate(): any {
        if (this._disposed) return false;
        if (this.active) return false;
        this._active = true;

        this.executor.executeAllocations();
        return true;
    }

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

        this.group.removeEffect(this);
        this.effectGroup = null;
    }

    protected layers: Layer[] = [];
    public getLayers() {
        return this.layers;
    }

    protected allocateLayers(count = 1) {
        const index = this.group.getEffectIndex(this);
        const layers = this.group.channel.allocateLayers({ count, index });
        this.layers.push(...layers);

        return layers;
    }

    protected deallocateLayers(layers: Layer[]) {
        for (const layer of layers) {
            const index = this.layers.indexOf(layer);
            if (index >= 0) this.layers.splice(index, 1);
        }

        this.group.channel.deallocateLayers(layers);
    }

    public updatePositions() {

    }
}