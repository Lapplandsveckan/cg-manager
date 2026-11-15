// Shared by the server and the web UI: keep this file free of imports.

export interface VideoMode {
    id: string;
    width: number;
    height: number;
    /** Frames per second is `timeScale / duration` (an interlaced mode counts frames, not fields). */
    timeScale: number;
    duration: number;
    /** Audio samples per frame at 48 kHz, repeating. */
    cadence: number[];
    interlaced: boolean;
}

export interface CustomVideoMode {
    id: string;
    width: number;
    height: number;
    timeScale: number;
    duration: number;
    cadence: number;
}

export interface VideoModeConfig {
    channels?: { videoMode: string }[];
    videoModes?: CustomVideoMode[];
}

type Rate = Pick<VideoMode, 'timeScale' | 'duration' | 'cadence'>;

const NTSC_CADENCE = [1602, 1601, 1602, 1601, 1602];

const RATE_2398: Rate = { timeScale: 24000, duration: 1001, cadence: [2002] };
const RATE_2400: Rate = { timeScale: 24000, duration: 1000, cadence: [2000] };
const RATE_2500: Rate = { timeScale: 25000, duration: 1000, cadence: [1920] };
const RATE_2997: Rate = {
    timeScale: 30000,
    duration: 1001,
    cadence: NTSC_CADENCE,
};
const RATE_3000: Rate = { timeScale: 30000, duration: 1000, cadence: [1600] };
const RATE_5000: Rate = { timeScale: 50000, duration: 1000, cadence: [960] };
const RATE_5994: Rate = {
    timeScale: 60000,
    duration: 1001,
    cadence: [801, 800, 801, 801, 801],
};
const RATE_6000: Rate = { timeScale: 60000, duration: 1000, cadence: [800] };

const progressive = (
    id: string,
    width: number,
    height: number,
    rate: Rate,
): VideoMode => ({ id, width, height, ...rate, interlaced: false });

// An interlaced id names its field rate: 1080i5000 is 25 frames per second.
const interlaced = (
    id: string,
    width: number,
    height: number,
    frameRate: Rate,
): VideoMode => ({ id, width, height, ...frameRate, interlaced: true });

export const BUILTIN_MODES: readonly VideoMode[] = [
    interlaced('PAL', 720, 576, RATE_2500),
    interlaced('NTSC', 720, 486, RATE_2997),
    progressive('576p2500', 720, 576, RATE_2500),
    progressive('720p2398', 1280, 720, RATE_2398),
    progressive('720p2400', 1280, 720, RATE_2400),
    progressive('720p2500', 1280, 720, RATE_2500),
    progressive('720p5000', 1280, 720, RATE_5000),
    progressive('720p2997', 1280, 720, RATE_2997),
    progressive('720p5994', 1280, 720, RATE_5994),
    progressive('720p3000', 1280, 720, RATE_3000),
    progressive('720p6000', 1280, 720, RATE_6000),
    progressive('1080p2398', 1920, 1080, RATE_2398),
    progressive('1080p2400', 1920, 1080, RATE_2400),
    interlaced('1080i5000', 1920, 1080, RATE_2500),
    interlaced('1080i5994', 1920, 1080, RATE_2997),
    interlaced('1080i6000', 1920, 1080, RATE_3000),
    progressive('1080p2500', 1920, 1080, RATE_2500),
    progressive('1080p2997', 1920, 1080, RATE_2997),
    progressive('1080p3000', 1920, 1080, RATE_3000),
    progressive('1080p5000', 1920, 1080, RATE_5000),
    progressive('1080p5994', 1920, 1080, RATE_5994),
    progressive('1080p6000', 1920, 1080, RATE_6000),
    progressive('1556p2398', 2048, 1556, RATE_2398),
    progressive('1556p2400', 2048, 1556, RATE_2400),
    progressive('1556p2500', 2048, 1556, RATE_2500),
    progressive('dci1080p2398', 2048, 1080, RATE_2398),
    progressive('dci1080p2400', 2048, 1080, RATE_2400),
    progressive('dci1080p2500', 2048, 1080, RATE_2500),
    progressive('2160p2398', 3840, 2160, RATE_2398),
    progressive('2160p2400', 3840, 2160, RATE_2400),
    progressive('2160p2500', 3840, 2160, RATE_2500),
    progressive('2160p2997', 3840, 2160, RATE_2997),
    progressive('2160p3000', 3840, 2160, RATE_3000),
    progressive('2160p5000', 3840, 2160, RATE_5000),
    progressive('2160p5994', 3840, 2160, RATE_5994),
    progressive('2160p6000', 3840, 2160, RATE_6000),
    progressive('dci2160p2398', 4096, 2160, RATE_2398),
    progressive('dci2160p2400', 4096, 2160, RATE_2400),
    progressive('dci2160p2500', 4096, 2160, RATE_2500),
];

export const BUILTIN_MODE_IDS: readonly string[] = BUILTIN_MODES.map(
    mode => mode.id,
);

const fromCustom = (mode: CustomVideoMode): VideoMode => ({
    ...mode,
    cadence: [mode.cadence],
    interlaced: false,
});

const sameId = (id: string) => (mode: { id: string }) =>
    mode.id.toLowerCase() === id.toLowerCase();

/** A custom mode wins over a built-in one with the same id, as it does in CasparCG. */
export function videoModeById(
    id: string,
    customModes: CustomVideoMode[] = [],
): VideoMode | null {
    const custom = customModes.find(sameId(id));
    if (custom) return fromCustom(custom);

    return BUILTIN_MODES.find(sameId(id)) ?? null;
}

/** `casparChannel` is 1-based, as in AMCP. */
export function channelVideoMode(
    config: VideoModeConfig | null | undefined,
    casparChannel: number,
): VideoMode | null {
    const id = config?.channels?.[casparChannel - 1]?.videoMode;
    if (!id) return null;

    return videoModeById(id, config.videoModes);
}

export const framesPerSecond = (mode: VideoMode) =>
    mode.timeScale / mode.duration;
