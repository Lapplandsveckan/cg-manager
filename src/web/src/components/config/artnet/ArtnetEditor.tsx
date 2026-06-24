import React from 'react';
import { ARTNET_EDITORS } from './variants';
import { type ArtnetEditorProps } from './types';

export const ArtnetEditor: React.FC<ArtnetEditorProps> = ({
    variant,
    ...rest
}) => {
    const Editor = ARTNET_EDITORS[variant] ?? ARTNET_EDITORS.legacy;
    return <Editor {...rest} />;
};
