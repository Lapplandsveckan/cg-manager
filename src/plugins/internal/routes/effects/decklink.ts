import {
    ClearCommand,
    Command,
    Effect,
    EffectGroup,
    PauseCommand,
    PlayCommand,
    Transform,
    LoadBGCommand,
    ResumeCommand, MixerCommand,
} from '@lappis/cg-manager';


type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface DecklinkEffectOptions {
    device: number;
    format: string;

    edgeblend?: Tuple<number, 7>;
    transform?: Tuple<number, 8>;
}

export class DecklinkEffect extends Effect {
    protected options: DecklinkEffectOptions;

    public constructor(group: EffectGroup, options: DecklinkEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers();

        if (options.transform) this.setTransform(Transform.fromArray(options.transform));
    }

    protected playing: boolean = false;
    protected paused: boolean = false;

    public activate(play: boolean = true) {
        if (!super.activate()) return;
        this.applyEdgeblend();

        let commandType = LoadBGCommand;
        if (play) commandType = PlayCommand;

        const cmd = commandType.decklink(this.options.device, this.options.format);
        cmd.allocate(this.layer);

        if (play) this.handlePlay();
        return this.executor.execute(cmd);
    }

    protected get layer() {
        return this.layers[0];
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
                    .allocate(layer)
            );
    }

    public play() {
        if (!this.active) return this.activate(true);
        if (this.playing) return;

        const cmd = PlayCommand.decklink(this.options.device, this.options.format);
        cmd.allocate(this.layer);

        this.handlePlay();
        return this.executor.execute(cmd);
    }

    protected handlePlay() {
        this.playing = true;
        this.paused = false;

        this.emit('video:play');
    }

    public pause() {
        if (!this.active) return;
        if (!this.playing) return;
        this.emit('video:pause');

        this.playing = false;
        this.paused = true;

        const cmd = new PauseCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public resume() {
        if (!this.active) return;
        if (!this.paused) return;
        this.emit('video:resume');

        this.playing = true;
        this.paused = false;

        const cmd = new ResumeCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;
        this.emit('video:deactivate');

        this.playing = false;

        const cmd: Command = new ClearCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public getMetadata(): {} {
        return {
            playing: this.playing,

            device: this.options.device,
            format: this.options.format,
        };
    }
}