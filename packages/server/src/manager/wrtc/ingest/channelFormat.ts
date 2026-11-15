import { channelVideoMode } from '../../../shared/videoModes';
import { Logger } from '../../../util/log';
import { type Config } from '../../caspar/config/types';

export interface OutputFormat {
    width: number;
    height: number;
    fpsNumerator: number;
    fpsDenominator: number;
}

const logger = Logger.scope('Ingest');

const FALLBACK_FORMAT: OutputFormat = {
    width: 1920,
    height: 1080,
    fpsNumerator: 30,
    fpsDenominator: 1,
};

export function channelFormat(
    casparChannel: number,
    runningConfig: Config | null,
): OutputFormat {
    const mode = channelVideoMode(runningConfig, casparChannel);
    if (!mode) {
        logger.warn(
            `No known video mode for channel ${casparChannel}; using 1920x1080 at 30 fps`,
        );
        return FALLBACK_FORMAT;
    }

    return {
        width: mode.width,
        height: mode.height,
        fpsNumerator: mode.timeScale,
        fpsDenominator: mode.duration,
    };
}
