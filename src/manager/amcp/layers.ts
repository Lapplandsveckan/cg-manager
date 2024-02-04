import {Effect} from './effect';
import {CommandGroup} from './command';
import {ClearCommand} from './commands/clear';
import {SwapCommand} from './commands/swap';
import {BasicChannel, BasicLayer} from './basic';
import {CommandExecutor} from './executor';
import {UUID} from "../../util/uuid";

export interface AllocateOptions {
    count?: number;
    index?: number;
}

export class EffectGroup {
    public effects: Effect[] = [];

    public readonly name: string;
    public readonly channel: Channel;

    constructor(channel: Channel, name: string) {
        this.name = name;
        this.channel = channel;
    }

    public addEffect(effect: Effect) {
        this.effects.push(effect);
    }
    public removeEffect(effect: Effect) {
        const index = this.effects.indexOf(effect);
        if (index >= 0) this.effects.splice(index, 1);
    }
    public dispose() {
        for (const effect of this.effects) effect.dispose();
    }

    /** Gets the first index that is after all previous effects, and after all the effects layer. AKA the index for a new layer */
    public getEffectIndex(effect: Effect) {
        let index = this.effects.indexOf(effect);
        if (index < 0) throw new Error('Effect not found in group');

        while (index >= 0) {
            const effect = this.effects[index];
            const layers = effect.getLayers();
            if (layers.length) {
                const layer = layers[layers.length - 1];
                return this.channel.getLayerIndex(layer) + 1;
            }

            index--;
        }

        return this.getStartingIndex();
    }

    /** Gets the first index that is after all other effect groups */
    protected getStartingIndex() {
        let index = this.channel.groups.indexOf(this);
        if (index < 0) throw new Error('Effect group not found in channel');
        if (index === 0) return 0;

        while (index > 0) {
            index--;

            const group = this.channel.groups[index];
            if (group.effects.length < 1) continue;

            const effects = group.effects;
            let i = effects.length - 1;
            while (i >= 0) {
                const effect = effects[i];
                if (effect.getLayers().length) break;

                i--;
            }

            if (i < 0) continue;

            const effect = effects[i];
            const layers = effect.getLayers();
            const layer = layers[layers.length - 1];
            return this.channel.getLayerIndex(layer) + 1;
        }

        return 0;
    }
}

export class Channel extends BasicChannel{
    public layers = new Map<number, Layer>();
    public groups: EffectGroup[] = [];

    public createGroup(name: string, index = -1) {
        const group = new EffectGroup(this, name);

        index = index < 0 ? this.groups.length : index;
        this.groups.splice(index, 0, group);

        return group;
    }
    public getGroup(name?: string) {
        name = name ?? UUID.generate();

        const group = this.groups.find(group => group.name === name);
        return group ?? this.createGroup(name);
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

    public getLayerIndex(layer: Layer) {
        return this.currentOrder.indexOf(layer.id);
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