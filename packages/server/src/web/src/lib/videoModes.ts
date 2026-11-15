import { BUILTIN_MODE_IDS, BUILTIN_MODES } from '../../../shared/videoModes';

export {
    BUILTIN_MODES,
    channelVideoMode,
    framesPerSecond,
    videoModeById,
    type VideoMode,
} from '../../../shared/videoModes';

// CasparCG built-in video mode ids. Used as fallback options when the host
// config defines no custom modes, and as the "Built-in" group in selectors.
export const BUILTIN_VIDEO_MODES = BUILTIN_MODE_IDS;

export const BUILTIN_MODE_SIZES: Record<
    string,
    { width: number; height: number }
> = Object.fromEntries(
    BUILTIN_MODES.map(({ id, width, height }) => [id, { width, height }]),
);
