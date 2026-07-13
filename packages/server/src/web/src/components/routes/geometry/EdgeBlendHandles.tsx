import React, { useRef } from 'react';
import { Box } from '@mui/material';
import { useGlobalDrag, toNorm } from '../../../hooks/useGeometryDrag';
import {
    type EdgeBlendInsets,
    type NormPoint,
    HANDLE_SIZE,
    SECONDARY,
} from './types';

type Edge = 'left' | 'right' | 'top' | 'bottom';

interface EdgeBlendHandlesProps {
    insets: EdgeBlendInsets;
    onChange: (next: EdgeBlendInsets) => void;
    width: number;
    height: number;
    stageRef: React.RefObject<HTMLElement | null>;
}

// Range is clamped per-edge so left+right (and top+bottom) can never overlap.
export const EdgeBlendHandles: React.FC<EdgeBlendHandlesProps> = props => {
    const { insets, onChange, width, height, stageRef } = props;
    const stateRef = useRef<{
        edge: Edge;
        start: NormPoint;
        startInsets: EdgeBlendInsets;
    } | null>(null);

    const drag = useGlobalDrag({
        onMove: (clientX, clientY) => {
            const stage = stageRef.current;
            const state = stateRef.current;
            if (!stage || !state) return;
            const now = toNorm(stage, clientX, clientY);
            const dx = now.x - state.start.x;
            const dy = now.y - state.start.y;
            const max = 0.5;
            const s = state.startInsets;
            const next = { ...s };
            const clamp = (v: number, lim: number) =>
                Math.max(0, Math.min(max, Math.min(lim, v)));
            if (state.edge === 'left')
                next.left = clamp(s.left + dx, 1 - s.right);
            if (state.edge === 'right')
                next.right = clamp(s.right - dx, 1 - s.left);
            if (state.edge === 'top')
                next.top = clamp(s.top + dy, 1 - s.bottom);
            if (state.edge === 'bottom')
                next.bottom = clamp(s.bottom - dy, 1 - s.top);
            onChange(next);
        },
    });

    const begin = (e: React.PointerEvent, edge: Edge) => {
        const stage = stageRef.current;
        if (!stage) return;
        e.stopPropagation();
        drag.begin(e);
        stateRef.current = {
            edge,
            start: toNorm(stage, e.clientX, e.clientY),
            startInsets: { ...insets },
        };
    };

    const bands: {
        edge: Edge;
        style: React.CSSProperties;
        grad: string;
        hasWidth: boolean;
    }[] = [
        {
            edge: 'left',
            style: { left: 0, top: 0, width: insets.left * width, height },
            grad: `linear-gradient(to right, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.left > 0,
        },
        {
            edge: 'right',
            style: { right: 0, top: 0, width: insets.right * width, height },
            grad: `linear-gradient(to left, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.right > 0,
        },
        {
            edge: 'top',
            style: { left: 0, top: 0, width, height: insets.top * height },
            grad: `linear-gradient(to bottom, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.top > 0,
        },
        {
            edge: 'bottom',
            style: {
                left: 0,
                bottom: 0,
                width,
                height: insets.bottom * height,
            },
            grad: `linear-gradient(to top, ${SECONDARY}55, ${SECONDARY}00)`,
            hasWidth: insets.bottom > 0,
        },
    ];

    interface Hp {
        edge: Edge;
        left?: number;
        top?: number;
        right?: number;
        bottom?: number;
        vertical: boolean;
    }
    const handlePositions: Hp[] = [
        {
            edge: 'left',
            left: insets.left * width,
            top: height / 2,
            vertical: false,
        },
        {
            edge: 'right',
            right: insets.right * width,
            top: height / 2,
            vertical: false,
        },
        {
            edge: 'top',
            left: width / 2,
            top: insets.top * height,
            vertical: true,
        },
        {
            edge: 'bottom',
            left: width / 2,
            bottom: insets.bottom * height,
            vertical: true,
        },
    ];

    return (
        <>
            {bands
                .filter(b => b.hasWidth)
                .map(b => (
                    <Box
                        key={b.edge}
                        sx={{
                            position: 'absolute',
                            ...b.style,
                            background: b.grad,
                            pointerEvents: 'none',
                        }}
                    />
                ))}
            {insets.left > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: insets.left * width,
                        top: 0,
                        width: 0,
                        height,
                        borderLeft: `1px dashed ${SECONDARY}88`,
                        pointerEvents: 'none',
                    }}
                />
            )}
            {insets.right > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        right: insets.right * width,
                        top: 0,
                        width: 0,
                        height,
                        borderRight: `1px dashed ${SECONDARY}88`,
                        pointerEvents: 'none',
                    }}
                />
            )}
            {insets.top > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        top: insets.top * height,
                        width,
                        height: 0,
                        borderTop: `1px dashed ${SECONDARY}88`,
                        pointerEvents: 'none',
                    }}
                />
            )}
            {insets.bottom > 0 && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: 0,
                        bottom: insets.bottom * height,
                        width,
                        height: 0,
                        borderBottom: `1px dashed ${SECONDARY}88`,
                        pointerEvents: 'none',
                    }}
                />
            )}
            {handlePositions.map(p => (
                <Box
                    key={p.edge}
                    sx={{
                        position: 'absolute',
                        left:
                            p.left !== undefined
                                ? p.left - HANDLE_SIZE / 2
                                : undefined,
                        right:
                            p.right !== undefined
                                ? p.right - HANDLE_SIZE / 2
                                : undefined,
                        top:
                            p.top !== undefined
                                ? p.top - HANDLE_SIZE / 2
                                : undefined,
                        bottom:
                            p.bottom !== undefined
                                ? p.bottom - HANDLE_SIZE / 2
                                : undefined,
                        width: HANDLE_SIZE,
                        height: HANDLE_SIZE,
                        borderRadius: '50%',
                        background: '#fff',
                        border: `2px solid ${SECONDARY}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        cursor: p.vertical ? 'ns-resize' : 'ew-resize',
                        touchAction: 'none',
                        zIndex: 4,
                    }}
                    onPointerDown={e => begin(e, p.edge)}
                />
            ))}
        </>
    );
};
