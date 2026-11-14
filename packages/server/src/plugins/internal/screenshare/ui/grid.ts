export function tileTransform(index: number, count: number): number[] {
    const columns = Math.ceil(Math.sqrt(count));
    const width = 1 / columns;
    const height = 1 / Math.ceil(count / columns);

    const x = (index % columns) * width;
    const y = Math.floor(index / columns) * height;

    const uncroppedSource = [0, 0, 1, 1];
    const tile = [x, y, x + width, y + height];

    return [...uncroppedSource, ...tile];
}
