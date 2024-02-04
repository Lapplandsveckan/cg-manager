import {Command, CommandGroup, LayeredCommand, RawCommand} from '../command';

interface ChromaEnabled {
    enabled: true;
    target_hue: number;
    hue_width: number;
    min_saturation: number;
    min_brightness: number;
    softness: number;
    spill_suppress: number;
    spill_suppress_saturation: number;
    show_mask: boolean;
}

interface ChromaDisabled {
    enabled: false;
}

type Chrome = ChromaEnabled | ChromaDisabled;

interface Levels {
    min_input: number;
    max_input: number;
    gamma: number;
    min_output: number;
    max_output: number;
}

interface Fill {
    x: number;
    y: number;
    x_scale: number;
    y_scale: number;
}

interface Clip {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Anchor {
    x: number;
    y: number;
}

interface Crop {
    left_edge: number;
    top_edge: number;
    right_edge: number;
    bottom_edge: number;
}

interface Perspective {
    top_left: Anchor;
    top_right: Anchor;
    bottom_right: Anchor;
    bottom_left: Anchor;
}

interface Tween {
    type: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    duration: number;
}

class MixerSingleCommand extends LayeredCommand {
    private readonly command: string;
    private readonly args: string[];

    constructor(command: string, args: string[] = []) {
        super();
        this.command = command;
        this.args = args;
    }

    public getCommandType(): string {
        return 'MIXER';
    }

    public getArguments(): string[] {
        const position = this.getPosition();
        return [position, this.command, ...this.args];
    }
}

export class MixerCommand extends CommandGroup {
    private readonly shouldClear: boolean;

    constructor(shouldClear: boolean = false) {
        super([]);
        this.shouldClear = shouldClear;
    }

    protected single(command: string, args: string[] = []) {
        const mixer = new MixerSingleCommand(command, args);
        this.commands.push(mixer);
        return this;
    }

    public static create() {
        return new MixerCommand();
    }

    public static clear() {
        return new MixerCommand(true);
    }

    public keyer(keyer: number) {
        return this.single('KEYER', [keyer.toString()]);
    }

    public chroma(chroma: Chrome, tween: Tween) {
        if (!chroma.enabled) return this.single('CHROMA', ['0']);

        const args = [
            1,

            chroma.target_hue,
            chroma.hue_width,
            chroma.min_saturation,
            chroma.min_brightness,
            chroma.softness,
            chroma.spill_suppress,
            chroma.spill_suppress_saturation,
            chroma.show_mask ? 1 : 0,

            tween.duration,
            tween.type,
        ];

        return this.single('CHROMA', args.map(arg => arg.toString()));
    }

    public blend(blend: string) {
        return this.single('BLEND', [blend]);
    }

    public invert(invert: boolean) {
        return this.single('INVERT', [invert ? '1' : '0']);
    }

    public opacity(opacity: number, tween: Tween) {
        const args = [
            opacity,
            tween.duration,
            tween.type,
        ];

        return this.single('OPACITY', args.map(arg => arg.toString()));
    }

    public brightness(brightness: number, tween: Tween) {
        const args = [
            brightness,
            tween.duration,
            tween.type,
        ];

        return this.single('BRIGHTNESS', args.map(arg => arg.toString()));
    }

    public saturation(saturation: number, tween: Tween) {
        const args = [
            saturation,
            tween.duration,
            tween.type,
        ];

        return this.single('SATURATION', args.map(arg => arg.toString()));
    }

    public contrast(contrast: number, tween: Tween) {
        const args = [
            contrast,
            tween.duration,
            tween.type,
        ];

        return this.single('CONTRAST', args.map(arg => arg.toString()));
    }

    public levels(levels: Levels, tween: Tween) {
        const args = [
            levels.min_input,
            levels.max_input,
            levels.gamma,
            levels.min_output,
            levels.max_output,

            tween.duration,
            tween.type,
        ];

        return this.single('LEVELS', args.map(arg => arg.toString()));
    }

    public fill(fill: Fill, tween: Tween) {
        const args = [
            fill.x,
            fill.y,
            fill.x_scale,
            fill.y_scale,

            tween.duration,
            tween.type,
        ];

        return this.single('FILL', args.map(arg => arg.toString()));
    }

    public clip(clip: Clip, tween: Tween) {
        const args = [
            clip.x,
            clip.y,
            clip.width,
            clip.height,

            tween.duration,
            tween.type,
        ];

        return this.single('CLIP', args.map(arg => arg.toString()));
    }

    public anchor(anchor: Anchor, tween: Tween) {
        const args = [
            anchor.x,
            anchor.y,

            tween.duration,
            tween.type,
        ];

        return this.single('ANCHOR', args.map(arg => arg.toString()));
    }

    public crop(crop: Crop, tween: Tween) {
        const args = [
            crop.left_edge,
            crop.top_edge,
            crop.right_edge,
            crop.bottom_edge,

            tween.duration,
            tween.type,
        ];

        return this.single('CROP', args.map(arg => arg.toString()));
    }

    public rotation(angle: number, tween: Tween) {
        const args = [
            angle,

            tween.duration,
            tween.type,
        ];

        return this.single('ROTATION', args.map(arg => arg.toString()));
    }

    public perspective(perspective: Perspective, tween: Tween) {
        const args = [
            perspective.top_left.x,
            perspective.top_left.y,
            perspective.top_right.x,
            perspective.top_right.y,
            perspective.bottom_right.x,
            perspective.bottom_right.y,
            perspective.bottom_left.x,
            perspective.bottom_left.y,

            tween.duration,
            tween.type,
        ];

        return this.single('PERSPECTIVE', args.map(arg => arg.toString()));
    }

    public mipmap(mipmap: boolean) {
        return this.single('MIPMAP', [mipmap ? '1' : '0']);
    }

    public volume(volume: number, tween: Tween) {
        const args = [
            volume,

            tween.duration,
            tween.type,
        ];

        return this.single('VOLUME', args.map(arg => arg.toString()));
    }

    public mastervolume(volume: number) {
        return this.single('MASTERVOLUME', [volume.toString()]);
    }

    public straightAlphaOutput(enabled: boolean) {
        return this.single('STRAIGHT_ALPHA_OUTPUT', [enabled ? '1' : '0']);
    }

    public clear() {
        this.commands.splice(0, this.commands.length);
        return this;
    }
}