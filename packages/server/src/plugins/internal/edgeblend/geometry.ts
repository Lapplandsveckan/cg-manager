export interface ProjectorRect {
    index: number;
    col: number;
    row: number;
    x: number;
    y: number;
    w: number;
    h: number;
}

export const overlapFractions = (
    canvasSize: [number, number],
    projectorSize: [number, number],
    size: [number, number],
): [number, number] =>
    [0, 1].map(i => {
        const total = size[i] * projectorSize[i];
        const denom = total - projectorSize[i];
        if (denom <= 0) return 0;
        return Math.max(0, Math.min(1, (total - canvasSize[i]) / denom));
    }) as [number, number];

// step between adjacent projector origins = projectorSize * (1 - overlap)
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
