import React from 'react';
import { useTranslation } from 'next-i18next';
import type {
    EdgeBlendInsets,
    Perspective,
    NormRect,
} from '../GeometryHandles';
import {
    EdgeBlendHandles,
    PerspectiveHandles,
    RectHandles,
} from '../GeometryHandles';

type Tabkey = 'position' | 'perspective' | 'edgeblend';

interface StageContentProps {
    tab: Tabkey;
    stageRef: React.RefObject<HTMLElement | null>;
    width: number;
    height: number;
    destRect: NormRect;
    quad: Perspective;
    insets: EdgeBlendInsets;
    setDestRect: (r: NormRect) => void;
    setQuad: (q: Perspective) => void;
    setInsets: (i: EdgeBlendInsets) => void;
}

export const StageContent: React.FC<StageContentProps> = ({
    tab,
    stageRef,
    width,
    height,
    destRect,
    quad,
    insets,
    setDestRect,
    setQuad,
    setInsets,
}) => {
    const { t } = useTranslation('common');
    if (tab === 'position')
        return (
            <RectHandles
                rect={destRect}
                onChange={setDestRect}
                width={width}
                height={height}
                stageRef={stageRef}
                label={t('videoRoutes.geometry.fillLabel')}
            />
        );
    if (tab === 'perspective')
        return (
            <PerspectiveHandles
                quad={quad}
                onChange={setQuad}
                width={width}
                height={height}
                stageRef={stageRef}
            />
        );
    if (tab === 'edgeblend')
        return (
            <EdgeBlendHandles
                insets={insets}
                onChange={setInsets}
                width={width}
                height={height}
                stageRef={stageRef}
            />
        );
    return null;
};
