import {MixerCommand, Tween} from './commands/mixer';

export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    start: Point;
    end: Point;
}


export class Transform {
    public source: Rect;
    public destination: Rect;

    public fillTransition: Tween = null;
    public cropTransition: Tween = null;

    constructor(source: Rect, destination: Rect) {
        this.source = source;
        this.destination = destination;
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