import {Effect} from '../effect';
import {EffectGroup} from '../layers';
import {LoadBGCommand, PlayoutOptions} from '../commands/loadbg';
import {PlayCommand} from '../commands/play';
import {ClearCommand} from '../commands/clear';
import {PauseCommand} from '../commands/pause';
import {ResumeCommand} from '../commands/resume';
import {StopCommand} from '../commands/stop';
import {Command} from '../command';
import {FileDatabase} from '../../scanner/db';

export interface VideoEffectOptions extends PlayoutOptions {
    disposeOnStop?: boolean;
}

export class VideoEffect extends Effect {
    protected clip: string;
    protected options: VideoEffectOptions;

    public constructor(clip: string, group: EffectGroup, options?: VideoEffectOptions) {
        super(group);

        this.clip = clip;
        this.options = options || {};

        this.allocateLayers();
    }

    protected playing: boolean = false;
    protected paused: boolean = false;

    protected startedTime: number = -1;
    protected pausedTime: number = -1;
    protected pausedDuration: number;
    protected clipDuration: number;

    public activate(play: boolean = true) {
        if (!super.activate()) return;

        let commandType = LoadBGCommand;
        if (play) commandType = PlayCommand;

        const cmd = commandType.video(this.clip, this.options);
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

        const cmd = PlayCommand.video(this.clip);
        cmd.allocate(this.layer);

        this.handlePlay();
        return this.executor.execute(cmd);
    }

    private playTimeout: any;

    protected handlePlay() {
        this.playing = true;
        this.paused = false;

        if (this.options.loop) return;

        const media = FileDatabase.db.get(this.clip);
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
}