import path from 'path';
import {existsSync} from 'fs';
import managerConfig from '../../../util/config';

/**
 * Locate the ffmpeg binary CasparCG ships with. Falls back to a PATH
 * lookup ("ffmpeg") when `caspar-path` isn't set or the bundled binary
 * isn't where we expect — useful in dev where the manager runs without
 * caspar installed alongside.
 */
export function ffmpegBinary(): string {
    const folder = managerConfig['caspar-path'];
    if (!folder) return 'ffmpeg';

    const ext = process.platform === 'win32' ? '.exe' : '';
    const bundled = path.join(folder, `ffmpeg${ext}`);

    return existsSync(bundled) ? bundled : 'ffmpeg';
}
