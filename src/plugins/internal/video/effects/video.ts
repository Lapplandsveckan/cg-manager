import {Effect} from '../../../../manager/amcp/effect';
import {EffectGroup} from '../../../../manager/amcp/layers';
import {LoadBGCommand, PlayoutOptions} from '../../../../manager/amcp/commands/loadbg';
import {PlayCommand} from '../../../../manager/amcp/commands/play';
import {ClearCommand} from '../../../../manager/amcp/commands/clear';
import {PauseCommand} from '../../../../manager/amcp/commands/pause';
import {ResumeCommand} from '../../../../manager/amcp/commands/resume';
import {StopCommand} from '../../../../manager/amcp/commands/stop';
import {Command} from '../../../../manager/amcp/command';
import {FileDatabase} from '../../../../manager/scanner/db';
import {Transform} from '../../../../manager/amcp/transform';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface VideoEffectOptions extends PlayoutOptions {
    clip: string;
    disposeOnStop?: boolean;
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

        const cmd = commandType.video(this.options.clip, this.options);
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

        const cmd = PlayCommand.video(this.options.clip);
        cmd.allocate(this.layer);

        this.handlePlay();
        return this.executor.execute(cmd);
    }

    private playTimeout: any;

    protected handlePlay() {
        this.playing = true;
        this.paused = false;

        if (this.options.loop) return;

        const media = FileDatabase.db.get(this.options.clip);
        if (!media) return;

        const duration = media.mediainfo.format.duration;
        if (duration === undefined) return;

        this.playTimeout = setTimeout(() => this.handleFinish(), duration * 1000);
        this.startedTime = Date.now();
        this.clipDuration = duration;
    }

    protected handleFinish() {
        if (!this.active) return;
        this.deactivate();
    }

    public pause() {
        if (!this.active) return;
        if (!this.playing) return;
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

        clearTimeout(this.playTimeout);

        let cmd: Command = new ClearCommand(this.layer);
        if (this.playing) cmd = new StopCommand(this.layer);
        // TODO: do we want this ^^^?

        this.playing = false;

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