import { MixerCommand } from './commands';
import { type Command } from './command';
import { type Layer } from './layers';
import { Transform } from './transform';

export interface EffectGeometry {
    transform?: number[];
    edgeblend?: number[];
    perspective?: number[];
}

type TransformArray = Parameters<typeof Transform.fromArray>[0];

export const geometryTransform = (geometry: EffectGeometry) =>
    geometry.transform
        ? Transform.fromArray(geometry.transform as TransformArray)
        : null;

/* eslint-disable camelcase */
function perspectiveCommand(points: number[], layer: Layer) {
    const perspective = {
        top_left: { x: points[0], y: points[1] },
        top_right: { x: points[2], y: points[3] },
        bottom_right: { x: points[4], y: points[5] },
        bottom_left: { x: points[6], y: points[7] },
    };

    return MixerCommand.create().perspective(perspective).allocate(layer);
}
/* eslint-enable camelcase */

function edgeblendCommand(values: number[], layer: Layer) {
    const [left, top, right, bottom, g, p, a] = values;

    return MixerCommand.create()
        .edgeblend({ edgeblend: [left, top, right, bottom], g, p, a })
        .allocate(layer);
}

/** The mixer half of a route-style effect's geometry, for every layer it owns.
 *  Position goes through `Effect.setTransform` instead — see
 *  `geometryTransform`. */
export function geometryCommands(
    geometry: EffectGeometry,
    layers: Layer[],
): Command[] {
    return layers.flatMap(layer => [
        ...(geometry.edgeblend
            ? [edgeblendCommand(geometry.edgeblend, layer)]
            : []),
        ...(geometry.perspective
            ? [perspectiveCommand(geometry.perspective, layer)]
            : []),
    ]);
}
