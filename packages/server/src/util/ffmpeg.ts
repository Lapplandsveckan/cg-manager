import fs from 'fs';
import path from 'path';
import managerConfig from './config';

/** Where a binary would live if CasparCG shipped one; null when no install is configured. */
export function casparBinaryPath(name: string): string | null {
    const folder = managerConfig['caspar-path'];
    if (!folder) return null;

    const ext = process.platform === 'win32' ? '.exe' : '';
    return path.join(folder, `${name}${ext}`);
}

/** Windows ships ffmpeg.exe next to caspar; the Linux bundle has only shared libs. */
export function casparBinary(name: string): string | null {
    const bundled = casparBinaryPath(name);
    if (!bundled) return null;

    return fs.existsSync(bundled) ? bundled : null;
}

export const ffmpegBinary = () => casparBinary('ffmpeg') ?? 'ffmpeg';
