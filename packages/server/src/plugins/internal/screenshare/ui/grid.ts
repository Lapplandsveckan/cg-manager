/** Fill rect for tile `index` of a `count`-cell wall, as `Transform.fromArray`
 *  wants it: fill start/end followed by an uncropped source. One session is
 *  the whole screen, so the identity transform falls out of the same maths. */
export function tileTransform(index: number, count: number): number[] {
    const columns = Math.ceil(Math.sqrt(count));
    const width = 1 / columns;
    const height = 1 / Math.ceil(count / columns);

    const x = (index % columns) * width;
    const y = Math.floor(index / columns) * height;

    return [x, y, x + width, y + height, 0, 0, 1, 1];
}
