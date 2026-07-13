/** Pure geometry helpers shared by the host effect and the UI diagram.
 *  No Node/browser imports — safe to bundle in both environments. */

export interface ProjectorRect {
    index: number;
    col: number;
    row: number;
    /** Left edge in canvas pixels. */
    x: number;
    /** Top edge in canvas pixels. */
    y: number;
    w: number;
    h: number;
}

/**
 * Returns [overlapX, overlapY] as fractions in [0, 1].
 * Each fraction is the proportion of one projector's dimension that overlaps
 * with its neighbour. 0 means no overlap (single projector on that axis).
 */
export const overlapFractions = (
    canvasSize: [number, number],
    projectorSize: [number, number],
    size: [number, number],
): [number, number] =>
    [0, 1].map(i => {
        const total = size[i] * projectorSize[i];
        const denom = total - projectorSize[i]; // 0 when there is only 1 projector
        if (denom <= 0) return 0;
        return Math.max(0, Math.min(1, (total - canvasSize[i]) / denom));
    }) as [number, number];

/**
 * Computes the canvas-pixel position of every projector in the grid.
 * The step between adjacent projector origins accounts for the overlap:
 *   step = projectorSize * (1 - overlap)
 * Projectors are ordered left-to-right, top-to-bottom (col-major within row).
 */
export const projectorRects = (
    canvasSize: [number, number],
    projectorSize: [number, number],
    size: [number, number],
): ProjectorRect[] => {
    const [overlapX, overlapY] = overlapFractions(
        canvasSize,
        projectorSize,
        size,
    );
    const [cols, rows] = size;
    const [projW, projH] = projectorSize;
    const stepX = projW * (1 - overlapX);
    const stepY = projH * (1 - overlapY);

    const rects: ProjectorRect[] = [];
    for (let i = 0; i < cols * rows; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        rects.push({
            index: i,
            col,
            row,
            x: col * stepX,
            y: row * stepY,
            w: projW,
            h: projH,
        });
    }
    return rects;
};
