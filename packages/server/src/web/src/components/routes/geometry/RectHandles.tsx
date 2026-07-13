import React, { useRef } from 'react';
import { Box } from '@mui/material';
import { useGlobalDrag, toNorm } from '../../../hooks/useGeometryDrag';
import {
    type NormRect,
    type NormPoint,
    HANDLE_SIZE,
    PRIMARY,
    clamp01,
} from './types';

type RectHandle = 'move' | 'tl' | 'tr' | 'br' | 'bl';

interface RectHandlesProps {
    rect: NormRect;
    onChange: (rect: NormRect) => void;
    color?: string;
    label?: string;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

const handleBoxStyle = (
    corner: RectHandle,
    color: string,
): React.CSSProperties => {
    const isLeft = corner === 'tl' || corner === 'bl';
    const isTop = corner === 'tl' || corner === 'tr';
    return {
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        borderRadius: 3,
        background: '#fff',
        border: `1.5px solid ${color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        left: isLeft ? -HANDLE_SIZE / 2 : undefined,
        right: isLeft ? undefined : -HANDLE_SIZE / 2,
        top: isTop ? -HANDLE_SIZE / 2 : undefined,
        bottom: isTop ? undefined : -HANDLE_SIZE / 2,
        cursor:
            corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
        zIndex: 2,
    };
};

export function applyRectDrag(
    start: NormRect,
    handle: RectHandle,
    dx: number,
    dy: number,
): NormRect {
    if (handle === 'move') {
        const x = clamp01(start.x + dx);
        const y = clamp01(start.y + dy);
        return {
            x: Math.min(x, 1 - start.w),
            y: Math.min(y, 1 - start.h),
            w: start.w,
            h: start.h,
        };
    }

    const signX = handle === 'tr' || handle === 'br' ? 1 : -1;
    const signY = handle === 'bl' || handle === 'br' ? 1 : -1;
    const minSize = 0.02;

    let newW = Math.max(minSize, start.w + signX * dx);
    let newH = Math.max(minSize, start.h + signY * dy);
    let newX = signX === -1 ? start.x + (start.w - newW) : start.x;
    let newY = signY === -1 ? start.y + (start.h - newH) : start.y;

    if (signX === -1 && newX < 0) {
        newW += newX;
        newX = 0;
    } else if (signX === 1 && newX + newW > 1) {
        newW = 1 - newX;
    }

    if (signY === -1 && newY < 0) {
        newH += newY;
        newY = 0;
    } else if (signY === 1 && newY + newH > 1) {
        newH = 1 - newY;
    }

    return {
        x: newX,
        y: newY,
        w: Math.max(minSize, newW),
        h: Math.max(minSize, newH),
    };
}

export const RectHandles: React.FC<RectHandlesProps> = props => {
    const {
        rect,
        onChange,
        color = PRIMARY,
        label,
        width,
        height,
        stageRef,
    } = props;
    const stateRef = useRef<{
        handle: RectHandle;
        start: NormPoint;
        startRect: NormRect;
    } | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const now = toNorm(stage, clientX, clientY);
            const dx = now.x - state.start.x;
            const dy = now.y - state.start.y;
            onChange(applyRectDrag(state.startRect, state.handle, dx, dy));
        },
    });

    const begin = (e: React.PointerEvent, handle: RectHandle) => {
        const stage = stageRef.current;
        if (!stage) return;
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = {
            handle,
            start: toNorm(stage, e.clientX, e.clientY),
            startRect: { ...rect },
        };
    };

    return (
        <Box
            sx={{
                position: 'absolute',
                left: rect.x * width,
                top: rect.y * height,
                width: rect.w * width,
                height: rect.h * height,
                outline: `2px solid ${color}`,
                background: `${color}22`,
                cursor: 'move',
                touchAction: 'none',
                userSelect: 'none',
            }}
            onPointerDown={e => begin(e, 'move')}
        >
            {label && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        fontFamily: 'monospace',
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#fff',
                        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                    }}
                >
                    {label}
                </Box>
            )}
            {(['tl', 'tr', 'br', 'bl'] as RectHandle[]).map(corner => (
                <Box
                    key={corner}
                    sx={handleBoxStyle(corner, color)}
                    onPointerDown={e => begin(e, corner)}
                />
            ))}
        </Box>
    );
};
