export interface RecordingPreset {
    id: string;
    extension: string;
    alpha: boolean;
    args: string[];
}

// Extension point: add a preset here to support a new output format. No
// other file needs to change — `recordings.ts` looks presets up by id and
// passes `args` straight through to the AMCP `ADD ... FILE` consumer.
export const PRESETS: RecordingPreset[] = [
    {
        id: 'mp4-h264',
        extension: 'mp4',
        alpha: false,
        args: [
            '-format',
            'mp4',
            '-codec:v',
            'libx264',
            '-preset:v',
            'veryfast',
            '-crf:v',
            '18',
            '-filter:v',
            'format=yuv420p',
            '-codec:a',
            'aac',
            '-b:a',
            '192k',
            // Fragmented so the file stays playable if CasparCG is killed
            // mid-recording (a non-fragmented moov is only written on close).
            '-movflags',
            '+frag_keyframe+empty_moov',
        ],
    },
    {
        id: 'mov-prores4444',
        extension: 'mov',
        alpha: true,
        args: [
            '-format',
            'mov',
            '-codec:v',
            'prores_ks',
            '-profile:v',
            '4444',
            '-filter:v',
            'format=yuva444p10le',
            '-codec:a',
            'pcm_s16le',
        ],
    },
];

export const presetById = (id: string): RecordingPreset | undefined =>
    PRESETS.find(preset => preset.id === id);
