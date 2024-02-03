import {Effect} from './effect';
import {CommandGroup} from './command';
import {ClearCommand} from './commands/clear';
import {SwapCommand} from './commands/swap';
import {BasicChannel, BasicLayer} from './basic';
import {CommandExecutor} from './executor';

export interface IndexAllocation {
    index: number;
}

export interface GroupAllocation {
    group: string;
}

export interface BeforeAllocation {
    before: string | BasicLayer;
}

export interface AfterAllocation {
    after: string | BasicLayer;
}

export type AllocationTypes = IndexAllocation | GroupAllocation | BeforeAllocation | AfterAllocation | undefined;

export interface AllocateOptions {
    count?: number;
    index?: number;
}

export class Channel extends BasicChannel{
    public layers = new Map<number, Layer>();
    public groupOrder: string[] = [];
    public setGroupOrder(order: string[]) {
        this.groupOrder = order;

        // TODO: update the currentOrder
    }

    private lastOrder: number[] = [];
    private currentOrder: number[] = [];

    public executor: CommandExecutor;
    constructor(casparChannel: number, executor?: CommandExecutor) {
        super(casparChannel);
        this.executor = executor;
    }

    public setExecutor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public getLayer(id: number) {
        return this.layers.get(id);
    }

    public getLayers() {
        return this.currentOrder.map(id => this.layers.get(id)).filter(layer => layer !== undefined) as Layer[];
    }

    protected getActiveEffects() {
        const effects = new Set<Effect>();
        for (const layer of this.layers.values())
            for (const effect of layer.getActiveEffects())
                effects.add(effect);

        return effects;
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

        this.needExecute = true;
        return layers;
    }

    private needExecute = false;
    public allocateLayer(index?: number): Layer {
        return this.allocateLayers({
            index,
            count: 1,
        })[0];
    }

    public deallocateLayers(layers: Layer[]): void {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            layer['setLayerManager'](undefined);
            layer['setCasparLayer'](undefined);

            const index = this.currentOrder.indexOf(layer.id);
            this.currentOrder[index] = undefined;
            this.layers.delete(layer.id);
        }

        this.needExecute = true;
    }

    public executeAllocation() {
        if (!this.needExecute) return;
        this.needExecute = false;

        const commands = [];

        const swap = this.lastOrder.slice();
        for (let i = 0; i < swap.length; i++) {
            const id = swap[i];
            if (id === undefined) continue;

            const index = this.currentOrder.indexOf(id);
            if (index >= 0) continue;

            swap[i] = undefined;

            const layer = BasicLayer.caspar(this.casparChannel, i + 1);
            commands.push(new ClearCommand(layer));
        }

        for (let i = 0; i < this.currentOrder.length; i++) {
            const id = this.currentOrder[i];
            if (id === undefined) continue;

            const index = swap.indexOf(id);
            if (index === i) continue;
            if (index < 0) continue;

            swap[index] = swap[i];
            swap[i] = id;

            const layer1 = BasicLayer.caspar(this.casparChannel, i + 1);
            const layer2 = BasicLayer.caspar(this.casparChannel, index + 1);
            commands.push(new SwapCommand(layer1, layer2));
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

        const commandGroup = new CommandGroup(commands);
        this.executor.execute(commandGroup);

        const effects = this.getActiveEffects();
        for (const effect of effects) effect.updatePositions();
    }
}

export class Layer extends BasicLayer {
    public readonly id: number;
    public readonly group: string = '';
    private static layerCount = 0;

    constructor(channel: Channel, group?: string) {
        super(channel);
        this.id = Layer.layerCount++;
        this.group = group ?? '';
    }

    private effects = new Set<Effect>();
    public addEffect(effect: Effect) {
        this.effects.add(effect);
    }

    public removeEffect(effect: Effect) {
        this.effects.delete(effect);
    }

    public getActiveEffects() {
        return Array.from(this.effects.values());
    }

    public clearEffects() {
        for (const effect of this.effects) effect.deactivate();
        this.effects.clear();
    }

    public dispose() {
        this.clearEffects();
        (this.channel as Channel).deallocateLayers([this]);
    }
}