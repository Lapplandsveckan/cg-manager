/* eslint camelcase: 0 */

import {MixerCommand, Tween} from './commands/mixer';

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    start: Point;
    end: Point;
}

type Tuple<T, N extends number> = N extends N ? number extends N ? T[] : _TupleOf<T, N, []> : never;
type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N ? R : _TupleOf<T, N, [T, ...R]>;

export class Transform {
    public source: Rect;
    public destination: Rect;

    public fillTransition: Tween = null;
    public cropTransition: Tween = null;

    constructor(source: Rect, destination: Rect) {
        this.source = source;
        this.destination = destination;
    }

    public static getRect(sx: number, sy: number, ex: number, ey: number) {
        return {
            start: {x: sx, y: sy},
            end: {x: ex, y: ey},
        };
    }

    public static normalRect() {
        return Transform.getRect(0, 0, 1, 1);
    }

    public static fromArray(arr: Tuple<number, 8>) {
        return new Transform(
            Transform.getRect(arr[0], arr[1], arr[2], arr[3]),
            Transform.getRect(arr[4], arr[5], arr[6], arr[7]),
        );
    }

    public setTween();
    public setTween(tween: Tween);
    public setTween(fillTween: Tween, cropTween: Tween);

    public setTween(fillTween?: Tween, cropTween?: Tween) {
        if (fillTween === undefined) fillTween = null;
        if (cropTween === undefined) cropTween = fillTween;

        this.fillTransition = fillTween;
        this.cropTransition = cropTween;
    }

    private getFill(rect: Rect) {
        return {
            x: rect.start.x,
            y: rect.start.y,
            x_scale: rect.end.x - rect.start.x,
            y_scale: rect.end.y - rect.start.y,
        };
    }

    private getCrop(rect: Rect) {
        return {
            left_edge: rect.start.x,
            top_edge: rect.start.y,
            right_edge: rect.end.x,
            bottom_edge: rect.end.y,
        };
    }

    public getCommand() {
        return MixerCommand
            .create()
            .crop(this.getCrop(this.source), this.cropTransition)
            .fill(this.getFill(this.destination), this.fillTransition);
    }
}