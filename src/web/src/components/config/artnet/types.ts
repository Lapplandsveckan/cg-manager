import { type Capabilities } from '../../../lib/api/caspar';
import { type RecordData } from '../fields';

export type ArtnetVariant = Capabilities['artnet'];

export interface BaseFixture {
    type?: string;
    startAddress?: number;
    fixtureChannels?: number;
    width?: number;
    height?: number;
    fixtureCount?: string | number;
}

export interface LegacyFixture extends BaseFixture {
    fixtureCount?: number;
    x?: number;
    y?: number;
    rotation?: number;
}

export interface V2Fixture extends BaseFixture {
    host?: string;
    port?: number;
    universe?: number;
    fixtureCount?: string;
    flux?: { r?: number; g?: number; b?: number; w?: number };
    brightness?: number;
    rotation?: number;
    mirrorX?: boolean;
    mirrorY?: boolean;
    left?: number;
    top?: number;
}

export interface ArtnetVariantEditorProps {
    data: RecordData;
    canvasWidth: number;
    canvasHeight: number;
    previewChannel?: number | null;
    onChange: (data: RecordData) => void;
}

export interface ArtnetEditorProps extends ArtnetVariantEditorProps {
    variant: ArtnetVariant;
}
