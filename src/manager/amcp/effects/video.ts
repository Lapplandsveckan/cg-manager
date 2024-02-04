import {Effect} from '../effect';
import {EffectGroup} from '../layers';
import {LoadBGCommand, PlayoutOptions} from '../commands/loadbg';
import {PlayCommand} from '../commands/play';
import {ClearCommand} from '../commands/clear';
import {PauseCommand} from '../commands/pause';
import {ResumeCommand} from '../commands/resume';
import {StopCommand} from '../commands/stop';
import {Command} from '../command';

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
    public activate(play: boolean = true) {
        if (!super.activate()) return;
        if (play) this.playing = true;

        let commandType = LoadBGCommand;
        if (play) commandType = PlayCommand;

        const cmd = commandType.video(this.clip, this.options);
        cmd.allocate(this.layer);

        return this.executor.execute(cmd);
    }

    protected get layer() {
        return this.layers[0];
    }

    public play() {
        if (!this.active) return this.activate(true);
        if (this.playing) return;
        this.playing = true;

        const cmd = PlayCommand.video(this.clip);
        cmd.allocate(this.layer);

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

        let cmd: Command = new ClearCommand(this.layer);
        if (this.playing) cmd = new StopCommand(this.layer);
        // TODO: do we want this ^^^?

        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result
    }
}