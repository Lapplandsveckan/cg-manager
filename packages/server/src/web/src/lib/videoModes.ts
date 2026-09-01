// CasparCG built-in video modes. Used as fallback options when the host
// config defines no custom modes, and as the "Built-in" group in selectors.
export const BUILTIN_VIDEO_MODES: readonly string[] = [
    'PAL',
    'NTSC',
    '576p2500',
    '720p2398',
    '720p2400',
    '720p2500',
    '720p5000',
    '720p2997',
    '720p5994',
    '720p3000',
    '720p6000',
    '1080p2398',
    '1080p2400',
    '1080i5000',
    '1080i5994',
    '1080i6000',
    '1080p2500',
    '1080p2997',
    '1080p3000',
    '1080p5000',
    '1080p5994',
    '1080p6000',
    '1556p2398',
    '1556p2400',
    '1556p2500',
    'dci1080p2398',
    'dci1080p2400',
    'dci1080p2500',
    '2160p2398',
    '2160p2400',
    '2160p2500',
    '2160p2997',
    '2160p3000',
    '2160p5000',
    '2160p5994',
    '2160p6000',
    'dci2160p2398',
    'dci2160p2400',
    'dci2160p2500',
];

// width/height for every built-in mode, parsed from the id
// (e.g. '1080p5000' -> 1920x1080, '2160p2500' -> 3840x2160, 'PAL'/'NTSC' are
// SD and hand-written). Used to lay out visual editors (e.g. the Art-Net
// canvas) for a channel whose mode isn't in the custom videoModes list.
const RESOLUTION_BY_PREFIX: Record<string, { width: number; height: number }> =
    {
        '576': { width: 720, height: 576 },
        '720': { width: 1280, height: 720 },
        '1080': { width: 1920, height: 1080 },
        '1556': { width: 2048, height: 1556 },
        dci1080: { width: 2048, height: 1080 },
        '2160': { width: 3840, height: 2160 },
        dci2160: { width: 4096, height: 2160 },
    };

export const BUILTIN_MODE_SIZES: Record<
    string,
    { width: number; height: number }
> = {
    PAL: { width: 720, height: 576 },
    NTSC: { width: 720, height: 486 },
    ...Object.fromEntries(
        BUILTIN_VIDEO_MODES.filter(id => id !== 'PAL' && id !== 'NTSC').map(
            id => {
                const prefix = Object.keys(RESOLUTION_BY_PREFIX).find(p =>
                    id.startsWith(p),
                );
                return [
                    id,
                    prefix
                        ? RESOLUTION_BY_PREFIX[prefix]
                        : { width: 1920, height: 1080 },
                ];
            },
        ),
    ),
};
