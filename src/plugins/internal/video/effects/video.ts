import {
    ClearCommand,
    Command,
    Effect,
    EffectGroup,
    PauseCommand,
    PlayCommand,
    StopCommand,
    Transform,
    LoadBGCommand,
    ResumeCommand,
    PlayoutOptions,
} from '@lappis/cg-manager';
import { MediaDoc } from '@lappis/cg-manager/dist/types/scanner/db';


type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface VideoEffectOptions extends PlayoutOptions {
    media: MediaDoc;
    disposeOnStop?: boolean;
    holdLastFrame?: boolean;
    transform?: Tuple<number, 8>;
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

    protected startedTime: number = -1;
    protected pausedTime: number = -1;
    protected pausedDuration: number = 0;
    protected clipDuration: number;

    public activate(play: boolean = true) {
        if (!super.activate()) return;

        let commandType = LoadBGCommand;
        if (play) commandType = PlayCommand;

        const cmd = commandType.video(this.options.media.id, this.options);
        cmd.allocate(this.layer);

        if (play) this.handlePlay();
        return this.executor.execute(cmd);
    }

    protected get layer() {
        return this.layers[0];
    }

    public play() {
        if (!this.active) return this.activate(true);
        if (this.playing) return;

        const cmd = PlayCommand.video(this.options.media.id);
        cmd.allocate(this.layer);

        this.handlePlay();
        return this.executor.execute(cmd);
    }

    public waitForFinish() {
        return new Promise<void>(resolve => {
            if (!this.active) return resolve();
            this.once('video:finish', resolve);
        });
    }

    private playTimeout: any;

    protected handlePlay() {
        this.playing = true;
        this.paused = false;

        this.emit('video:play');
        if (this.options.loop) return;

        const duration = this.options.media.mediainfo.format.duration;
        if (duration === undefined) return;

        this.playTimeout = setTimeout(() => this.handleFinish(), duration * 1000);
        this.startedTime = Date.now();
        this.clipDuration = duration;
    }

    protected handleFinish() {
        if (!this.active) return;
        this.emit('video:finish');

        this.playing = false;
        if (!this.options.holdLastFrame) this.deactivate();
    }

    public pause() {
        if (!this.active) return;
        if (!this.playing) return;
        this.emit('video:pause');

        this.playing = false;
        this.paused = true;

        clearTimeout(this.playTimeout); // TODO: only pause the timeout
        this.pausedTime = Date.now();

        const cmd = new PauseCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public resume() {
        if (!this.active) return;
        if (!this.paused) return;
        this.emit('video:resume');

        this.playing = true;
        this.paused = false;

        const playTime = this.pausedTime - this.startedTime - this.pausedDuration;
        this.pausedDuration += Date.now() - this.pausedTime;
        this.pausedTime = -1;

        const duration = this.clipDuration * 1000 - playTime;
        this.playTimeout = setTimeout(() => this.handleFinish(), duration * 1000);

        const cmd = new ResumeCommand(this.layer);
        return this.executor.execute(cmd);
    }

    public deactivate() {
        if (!super.deactivate()) return;
        this.emit('video:deactivate');

        clearTimeout(this.playTimeout);
        this.playing = false;

        const cmd: Command = new ClearCommand(this.layer);
        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {
            playing: this.playing,

            startedTime: this.startedTime,
            pausedTime: this.pausedTime,

            pausedDuration: this.pausedDuration,
            clipDuration: this.clipDuration * 1000,

            playDuration: this.playing ? Date.now() - this.startedTime - this.pausedDuration : 0,
            now: Date.now(),
        };
    }
}