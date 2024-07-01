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

export interface VideoEffectOptions {
    video: string;

    edgeblend?: Tuple<number, 7>;
    transform?: Tuple<number, 8>;
    perspective?: Tuple<number, 8>;
}

export class VideoEffect extends Effect {
    protected options: VideoEffectOptions;

    public constructor(group: EffectGroup, options: VideoEffectOptions) {
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
        this.applyPerspective();

        let commandType = LoadBGCommand;
        if (play) {
            commandType = PlayCommand;
            this.playing = true;
            this.paused = false;
        }

        const cmd = commandType.video(this.options.video, { loop: true });
        cmd.allocate(this.layer);

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

    public play() {
        if (!this.active) return this.activate(true);
        if (this.playing) return;

        const cmd = PlayCommand.video(this.options.video);
        cmd.allocate(this.layer);

        this.playing = true;
        this.paused = false;

        return this.executor.execute(cmd);
    }

    public pause() {
        if (!this.active) return;
        if (!this.playing) return;

        this.playing = false;
        this.paused = true;

        const cmd = new PauseCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public resume() {
        if (!this.active) return;
        if (!this.paused) return;

        this.playing = true;
        this.paused = false;

        const cmd = new ResumeCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;
        this.playing = false;

        const cmd: Command = new ClearCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public getMetadata(): {} {
        return {
            playing: this.playing,
            video: this.options.video,
        };
    }
}
