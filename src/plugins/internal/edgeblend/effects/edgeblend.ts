import {
    Effect,
    EffectGroup,
    PlayCommand,
    StopCommand,
    Transform,
    Command, CommandGroup, MixerCommand, LayeredCommand, BasicChannel,
} from '@lappis/cg-manager';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface EdgeBlendOptions {
    edgeblend?: Tuple<number, 4>;
    g: number;
    p: number;
    a: number;
}

export interface EdgeBlendEffectOptions {
    source: BasicChannel;
    transform: Transform,
    edgeblend: EdgeBlendOptions;
}

class EdgeblendCommand extends LayeredCommand {
    private readonly options: EdgeBlendOptions;

    constructor(options: EdgeBlendOptions) {
        super();
        this.options = options;
    }

    public getCommandType(): string {
        return 'MIXER';
    }

    public getArguments(): string[] {
        const position = this.getPosition();
        const args = [...this.options.edgeblend, this.options.g, this.options.p, this.options.a].map(v => v.toString());
        return [position, 'EDGEBLEND', ...args];
    }
}

export class EdgeblendEffect extends Effect {
    protected options: EdgeBlendEffectOptions;

    public constructor(group: EffectGroup, options: EdgeBlendEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers();

        this.setTransform(options.transform);
    }

    protected get layer() {
        return this.layers[0];
    }

    public activate() {
        if (!super.activate()) return;

        const cmds = [
            PlayCommand.route(this.options.source),
            this.transform.getCommand(),
            new EdgeblendCommand(this.options.edgeblend),
        ];

        return this.executor.execute(new CommandGroup(cmds));
    }

    public deactivate() {
        if (!super.deactivate()) return;

        const cmds = [
            new StopCommand(this.layer),
            MixerCommand.clear().allocate(this.layer),
        ];
        return this.executor.execute(new CommandGroup(cmds));
    }

    public getMetadata(): {} {
        return {};
    }

    public updatePositions(): Command[] {
        if (!this.active) return [];
        return [
            PlayCommand
                .route(this.options.source)
                .allocate(this.layer),
        ];
    }
}