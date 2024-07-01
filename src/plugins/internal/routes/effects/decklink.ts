import {
    ClearCommand,
    Command,
    Effect,
    EffectGroup,
    PlayCommand,
    Transform,
    MixerCommand,
    CommandGroup,
} from '@lappis/cg-manager';


type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface DecklinkEffectOptions {
    device: number;
    format: string;

    keyDevice?: number;

    edgeblend?: Tuple<number, 7>;
    transform?: Tuple<number, 8>;
    perspective?: Tuple<number, 8>;
}

export class DecklinkEffect extends Effect {
    protected options: DecklinkEffectOptions;
    private keyer: boolean;

    public constructor(group: EffectGroup, options: DecklinkEffectOptions) {
        super(group);

        this.options = options;
        this.keyer = typeof options.keyDevice === 'number';
        this.allocateLayers(this.keyer ? 2 : 1);

        if (options.transform) this.setTransform(Transform.fromArray(options.transform));
    }

    public activate() {
        if (!super.activate()) return;
        this.applyEdgeblend();
        this.applyPerspective();

        const cmds = [
            PlayCommand
                .decklink(this.options.device, this.options.format)
                .allocate(this.layer),
        ];

        if (this.keyer)
            cmds.push(
                PlayCommand
                    .decklink(this.options.keyDevice!, this.options.format)
                    .allocate(this.keyLayer),

                MixerCommand
                    .create()
                    .keyer(1)
                    .allocate(this.keyLayer),
            );

        return this.executor.execute(new CommandGroup(cmds));
    }

    protected get layer() {
        return this.layers[this.keyer ? 1 : 0];
    }

    protected get keyLayer() {
        return this.keyer ? this.layers[0] : null;
    }

    protected applyEdgeblend() {
        if (!this.active) return;
        if (!this.options.edgeblend) return;

        const [...points] = this.options.edgeblend.slice(0, 4) as [number, number, number, number];
        const [g, p, a] = this.options.edgeblend.slice(4);

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand
                    .create()
                    .edgeblend({ edgeblend: points, g, p, a })
                    .allocate(layer),
            );
    }

    protected applyPerspective() {
        if (!this.active) return;
        if (!this.options.perspective) return;

        const perspective = {
            // eslint-disable-next-line camelcase
            top_left: { x: this.options.perspective[0], y: this.options.perspective[1] },
            // eslint-disable-next-line camelcase
            top_right: { x: this.options.perspective[2], y: this.options.perspective[3] },
            // eslint-disable-next-line camelcase
            bottom_right: { x: this.options.perspective[4], y: this.options.perspective[5] },
            // eslint-disable-next-line camelcase
            bottom_left: { x: this.options.perspective[6], y: this.options.perspective[7] },
        };

        for (const layer of this.layers)
            this.executor.execute(
                MixerCommand
                    .create()
                    .perspective(perspective)
                    .allocate(layer),
            );
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const cmd: Command = new ClearCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public getMetadata(): {} {
        return {
            device: this.options.device,
            format: this.options.format,

            keyDevice: this.options.keyDevice,
        };
    }
}
