import {Effect} from '../../../../manager/amcp/effect';
import {EffectGroup} from '../../../../manager/amcp/layers';
import {PlayCommand} from '../../../../manager/amcp/commands/play';
import {ClearCommand} from '../../../../manager/amcp/commands/clear';
import {CommandGroup} from '../../../../manager/amcp/command';
import {Logger} from '../../../../util/log';
import {MixerCommand} from '../../../../manager/amcp/commands/mixer';
import {Color} from '../../../../manager/amcp/commands/loadbg';

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export interface VideoEffectOptions {
    clip: string;
    disposeOnStop?: boolean;
}

export class MotionEffect extends Effect {
    protected options: VideoEffectOptions;

    public constructor(group: EffectGroup, options: VideoEffectOptions) {
        super(group);

        this.options = options;
        this.allocateLayers(2);
    }

    public get transitionDuration() {
        return 3;
    }

    public get FPS() {
        return 50; // TODO: get from config
    }

    public activate() {
        if (!super.activate()) return;

        const cmds = [
            PlayCommand
                .video(this.options.clip, { loop: true })
                .allocate(this.videoLayer),
        ];

        const useColor = true;
        if (useColor) {
            const mixerCmd = MixerCommand
                .create()
                .keyer(1)
                .brightness(2)
                .saturation(0)
                .allocate(this.videoLayer);

            const colorCmd = PlayCommand
                .color(Color.RGBA(255, 0, 0, 0))
                .allocate(this.colorLayer);

            cmds.push(mixerCmd);
            cmds.push(colorCmd);

            if (this.transitionDuration > 0) {
                const colorMixCmd = MixerCommand
                    .create()
                    .opacity(0)
                    .allocate(this.colorLayer);

                cmds.push(colorMixCmd);

                setTimeout(() => {
                    const colorMixCmd = MixerCommand
                        .create()
                        .opacity(1, this.transitionDuration * this.FPS)
                        .allocate(this.colorLayer);

                    this.executor.execute(colorMixCmd);
                }, 100);
            }
        }

        const cmd = new CommandGroup(cmds);
        return this.executor.execute(cmd);
    }

    protected get videoLayer() {
        return this.layers[0];
    }

    protected get colorLayer() {
        return this.layers[1];
    }

    public deactivate() {
        if (!super.deactivate()) return;
        if (this.transitionDuration < 1) return this._deactivate();

        const mixerCmd = MixerCommand
            .create()
            .opacity(0, this.transitionDuration * this.FPS)
            .allocate(this.colorLayer); // TODO: use videoLayer, if colorLayer is not used

        setTimeout(() => this._deactivate(), this.transitionDuration * 1000);
        return this.executor.execute(mixerCmd);
    }

    private _deactivate() {
        const cmd = new CommandGroup([new ClearCommand(this.videoLayer), new ClearCommand(this.colorLayer)]);
        const result = this.executor.execute(cmd);
        if (this.options.disposeOnStop) result.then(() => !this.active && this.dispose());

        return result;
    }

    public getMetadata(): {} {
        return {

        };
    }
}