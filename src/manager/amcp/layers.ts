import {Effect} from './effect';

interface AllocateOptions {
    count?: number;
    index?: number;

    now?: boolean;
}

export class LayerManager {
    public layers = new Map<number, Layer>();

    public lastOrder: number[] = [];
    public currentOrder: number[] = [];

    private casparChannel: number = undefined;

    constructor(casparChannel: number) {
        this.casparChannel = casparChannel;
    }

    public getLayer(id: number) {
        return this.layers.get(id);
    }

    public allocateLayers(options?: AllocateOptions): Layer[] {
        options = options ?? {};

        let count = options.count ?? 1;
        if (count < 1) throw new Error('You have to allocate at least 1 layer');

        const layers = new Array(count);
        const ids = new Array(count);
        for (let i = 0; i < count; i++) {
            const layer = new Layer(this);
            this.layers.set(layer.id, layer);

            layers[i] = layer;
            ids[i] = layer.id;
        }

        const index = options.index ?? this.currentOrder.length;
        this.currentOrder.splice(index, 0, ...ids);

        // We want to move the layers as little as possible,
        // so we'll try to remove empty space to try to keep it in the same place as before
        for (let i = index + 1; i < this.currentOrder.length && count > 0; i++) {
            const id = this.currentOrder[i];
            if (id !== undefined) continue;

            this.currentOrder.splice(i, 1);
            count--;
            i--;
        }

        if (options.now) this.executeAllocation();
        return layers;
    }

    public allocateLayer(index?: number, now?: boolean): Layer {
        return this.allocateLayers({
            index,
            count: 1,
            now,
        })[0];
    }

    public deallocateLayers(layers: Layer[], now?: boolean): void {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            layer['setLayerManager'](undefined);
            layer['setCasparLayer'](undefined);

            const index = this.currentOrder.indexOf(layer.id);
            this.currentOrder[index] = undefined;
            this.layers.delete(layer.id);
        }

        if (now) this.executeAllocation();
    }

    public executeAllocation() {
        const commands = [];

        const swap = this.lastOrder.slice();
        for (let i = 0; i < swap.length; i++) {
            const id = swap[i];
            if (id === undefined) continue;

            const index = this.currentOrder.indexOf(id);
            if (index >= 0) continue;

            swap[i] = undefined;
            commands.push(`CLEAR ${this.casparChannel}-${i + 1}`);
        }

        for (let i = 0; i < this.currentOrder.length; i++) {
            const id = this.currentOrder[i];
            if (id === undefined) continue;

            const index = swap.indexOf(id);
            if (index === i) continue;
            if (index < 0) continue;

            swap[index] = swap[i];
            swap[i] = id;

            commands.push(`SWAP ${this.casparChannel}-${i + 1} ${this.casparChannel}-${index + 1}`);
        }

        this.lastOrder = this.currentOrder;
        this.currentOrder = this.currentOrder.slice();

        for (let i = 0; i < this.currentOrder.length; i++) {
            const id = this.currentOrder[i];
            if (id === undefined) continue;

            const layer = this.layers.get(id);
            if (!layer) continue;

            layer['setCasparLayer'](i + 1);
        }

        LayerManager.sendCommand(commands.join('\n'));
    }

    private static sendCommand(command: string) {
        if (!command) return;
        console.log(`Sending command: ${command}`);
    }
}

export class Layer {
    public readonly id: number;
    public effects: Effect[] = [];

    private casparLayer: number = undefined;
    private layerManager: LayerManager = undefined;
    private static layerCount = 0;
    constructor(layerManager: LayerManager) {
        this.id = Layer.layerCount++;
        this.layerManager = layerManager;
    }

    private setLayerManager(layerManager: LayerManager) {
        this.layerManager = layerManager;

        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            effect.allocate(this.layerManager?.['casparChannel'], this.casparLayer);
        }
    }

    private setCasparLayer(layer: number) {
        this.casparLayer = layer;

        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            effect.allocate(this.layerManager?.['casparChannel'], layer);
        }
    }

    public addEffect(effect: Effect, activate = false) {
        if (!this.layerManager) return;
        if (!this.casparLayer) return;

        const channel = this.layerManager['casparChannel'];
        const layer = this.casparLayer;

        effect.allocate(channel, layer);
        this.effects.push(effect);

        if (activate) effect.activate();
    }

    public removeEffect(effect: Effect) {
        const index = this.effects.indexOf(effect);
        if (index < 0) return;

        effect.deactivate();
        effect.allocate();
        this.effects.splice(index, 1);
    }

    public activate() {
        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            effect.activate();
        }
    }

    public deactivate() {
        for (let i = 0; i < this.effects.length; i++) {
            const effect = this.effects[i];
            effect.deactivate();
        }
    }
}