import {LayeredCommand} from '../command';
import {BasicChannel, BasicLayer} from '../basic';

export enum Transition {
    CUT = 'CUT',
    MIX = 'MIX',
    SLIDE = 'SLIDE',
}

export enum Tween {
    Linear = 'Linear',
}

export enum Direction {
    LEFT = 'LEFT',
    RIGHT = 'RIGHT',
}

export interface PlayoutOptions {
    duration?: number;

    transition?: Transition;
    tween?: Tween;
    direction?: Direction;

    seek?: number;
    length?: number;
    filter?: string;

    loop?: boolean;
    auto?: boolean;
}

export class Color {
    public static RGBA(r: number, g: number, b: number, a?: number): string {
        if (r > 255 || r < 0) throw new Error('r must be between 0 and 255');
        if (g > 255 || g < 0) throw new Error('g must be between 0 and 255');
        if (b > 255 || b < 0) throw new Error('b must be between 0 and 255');

        if (a !== undefined && (a > 255 || a < 0)) throw new Error('a must be between 0 and 255');

        const v = [r, g, b];
        if (a !== undefined) v.unshift(a);

        const hex = v
            .map(v => v.toString(16).padStart(2, '0'))
            .join('');

        return `#${hex}`;
    }
}

export class Video {
    public static getVideoArguments(options?: PlayoutOptions): string[] {
        options = options || {};
        const args: string[] = [];

        if (options.transition) {
            args.push(options.transition);
            args.push((options.duration ?? 0).toString());

            if (options.tween) args.push(options.tween);
            if (options.direction) args.push(options.direction);
        }

        if (options.seek) args.push('SEEK', options.seek.toString());
        if (options.length) args.push('LENGTH', options.length.toString());
        if (options.filter) args.push('FILTER', options.filter);

        if (options.loop) args.push('LOOP');
        if (options.auto) args.push('AUTO');

        return args;
    }
}

export class LoadBGCommand extends LayeredCommand {
    private arguments: string[];
    protected getCommandType() {
        return 'LOADBG';
    }

    protected getArguments(): string[] {
        const position = this.getPosition();
        if (!position) return [];

        return [position, ...this.arguments];
    }

    constructor() {
        super();
        this.arguments = [];
    }

    private setArguments(...args: string[]) {
        this.arguments = args;
        return this;
    }

    public static video(video: string, options?: PlayoutOptions) {
        return new this()
            .setArguments(video, ...Video.getVideoArguments(options));
    }

    public static route(source: BasicLayer | BasicChannel) {
        return new this()
            .setArguments(`route://${source.getCommandString()}`);
    }

    public static color(color: string) {
        return new this()
            .setArguments(color);
    }
}