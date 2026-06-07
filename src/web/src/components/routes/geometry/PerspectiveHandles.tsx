import React, { useRef } from 'react';
import { Box } from '@mui/material';
import { useGlobalDrag, toNorm } from '../../../hooks/useGeometryDrag';
import { type Perspective, HANDLE_SIZE, SECONDARY, clamp01 } from './types';

type CornerKey = keyof Perspective;

interface PerspectiveHandlesProps {
    quad: Perspective;
    onChange: (quad: Perspective) => void;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

export const PerspectiveHandles: React.FC<PerspectiveHandlesProps> = ({
    quad,
    onChange,
    width,
    height,
    stageRef,
}) => {
    const stateRef = useRef<{ corner: CornerKey } | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const p = toNorm(stage, clientX, clientY);
            // CasparCG accepts perspective corners outside [0,1] for "stretch
            // beyond stage" warps, but for an interactive UI we keep them on
            // the stage to avoid the user dragging a point to (-9, 0) by
            // mistake.
            onChange({
                ...quad,
                [state.corner]: { x: clamp01(p.x), y: clamp01(p.y) },
            });
        },
    });

    const begin = (e: React.PointerEvent, corner: CornerKey) => {
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = { corner };
    };

    const corners: { key: CornerKey; cursor: string }[] = [
        { key: 'tl', cursor: 'nwse-resize' },
        { key: 'tr', cursor: 'nesw-resize' },
        { key: 'br', cursor: 'nwse-resize' },
        { key: 'bl', cursor: 'nesw-resize' },
    ];

    return (
        <>
            <Box
                component="svg"
                viewBox={`0 0 ${width} ${height}`}
                sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                }}
            >
                <polygon
                    points={[quad.tl, quad.tr, quad.br, quad.bl]
                        .map(p => `${p.x * width},${p.y * height}`)
                        .join(' ')}
                    fill={`${SECONDARY}22`}
                    stroke={SECONDARY}
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                />
            </Box>
            {corners.map(({ key, cursor }) => {
                const p = quad[key];
                return (
                    <Box
                        key={key}
                        sx={{
                            position: 'absolute',
                            left: p.x * width - HANDLE_SIZE / 2,
                            top: p.y * height - HANDLE_SIZE / 2,
                            width: HANDLE_SIZE,
                            height: HANDLE_SIZE,
                            borderRadius: '50%',
                            background: '#fff',
                            border: `2px solid ${SECONDARY}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            cursor,
                            touchAction: 'none',
                            zIndex: 3,
                        }}
                        onPointerDown={e => begin(e, key)}
                    />
                );
            })}
        </>
    );
};
