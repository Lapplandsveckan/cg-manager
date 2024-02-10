import {Effect} from './effect';
import {CommandGroup} from './command';
import {ClearCommand} from './commands/clear';
import {SwapCommand} from './commands/swap';
import {BasicChannel, BasicLayer} from './basic';
import {CommandExecutor} from './executor';
import { v4 as uuid } from 'uuid';

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
        this.channel.executor['effects'].set(effect.id, effect);
    }
    public removeEffect(effect: Effect) {
        const index = this.effects.indexOf(effect);
        if (index >= 0) this.effects.splice(index, 1);

        this.channel.executor['effects'].delete(effect.id);
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

    public toJSON() {
        return {
            name: this.name,
            effects: this.effects.map(effect => effect.id),
        };
    }
}

export class Channel extends BasicChannel{
    public layers = new Map<string, Layer>();
    public groups: EffectGroup[] = [];

    public createGroup(name: string, index = -1) {
        const group = new EffectGroup(this, name);

        index = index < 0 ? this.groups.length : index;
        this.groups.splice(index, 0, group);

        return group;
    }
    public getGroup(name?: string) {
        name = name ?? uuid();

        const group = this.groups.find(group => group.name === name);
        return group ?? this.createGroup(name);
    }

    private lastOrder: string[] = [];
    private currentOrder: string[] = [];

    public executor: CommandExecutor;
    constructor(casparChannel: number, executor?: CommandExecutor) {
        super(casparChannel);
        this.executor = executor;
    }

    public setExecutor(executor: CommandExecutor) {
        this.executor = executor;
    }

    public getLayer(id: string) {
        return this.layers.get(id);
    }

    public getLayers() {
        return this.currentOrder.map(id => this.layers.get(id)).filter(layer => layer !== undefined) as Layer[];
    }

    public getLayerIndex(layer: Layer) {
        return this.currentOrder.indexOf(layer.id);
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

            const layer = this.layers.get(id);
            layer['setCasparLayer'](i + 1);

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

        // TODO: call all effects to update their layers
    }

    public toJSON() {
        return {
            channel: this.casparChannel,

            layers: this.currentOrder.filter(v => v).map(v => this.layers.get(v)).map(layer => layer.toJSON()),
            groups: this.groups.map(group => group.toJSON()),
        };
    }
}

export class Layer extends BasicLayer {
    public readonly id: string;

    constructor(channel: Channel) {
        super(channel);
        this.id = uuid();
    }

    private effect: Effect;
    public setEffect(effect: Effect) {
        this.effect = effect;
    }

    public getEffect() {
        return this.effect;
    }

    public dispose() {
        (this.channel as Channel).deallocateLayers([this]);
    }

    public toJSON() {
        return {
            id: this.id,
            effect: this.effect?.id,
        };
    }
}