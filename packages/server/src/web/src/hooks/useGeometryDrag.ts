import { useEffect, useRef } from 'react';
import { type NormPoint } from '../components/routes/geometry/types';

interface PointerCaptureProps {
    onMove: (clientX: number, clientY: number) => void;
}

export function useGlobalDrag({ onMove }: PointerCaptureProps) {
    const activeRef = useRef(false);

    useEffect(() => {
        const move = (e: PointerEvent) => {
            if (activeRef.current) onMove(e.clientX, e.clientY);
        };
        const up = () => {
            activeRef.current = false;
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        return () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
        };
    }, [onMove]);

    return {
        begin: (e: React.PointerEvent) => {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            activeRef.current = true;
        },
    };
}

export function toNorm(
    stage: HTMLElement,
    clientX: number,
    clientY: number,
): NormPoint {
    const rect = stage.getBoundingClientRect();
    return {
        x: rect.width === 0 ? 0 : (clientX - rect.left) / rect.width,
        y: rect.height === 0 ? 0 : (clientY - rect.top) / rect.height,
    };
}
