import type React from 'react';
import { type ArtnetVariant, type ArtnetVariantEditorProps } from './types';
import { LegacyArtnetEditor } from './legacy/LegacyArtnetEditor';
import { V2ArtnetEditor } from './v2/V2ArtnetEditor';

export const ARTNET_EDITORS: Record<
    ArtnetVariant,
    React.FC<ArtnetVariantEditorProps>
> = {
    legacy: LegacyArtnetEditor,
    v2: V2ArtnetEditor,
};
