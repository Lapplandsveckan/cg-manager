import type {
    VideoRouteSource,
    VideoRouteDestination,
} from '../api/videoRoutes';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function summariseSource(
    t: Translate,
    source: VideoRouteSource,
): string {
    switch (source.type) {
        case 'decklink':
            return source.keyDevice !== undefined
                ? t('videoRoutes.summary.decklinkWithKey', {
                      device: source.device,
                      key: source.keyDevice,
                  })
                : t('videoRoutes.summary.decklink', { device: source.device });
        case 'video':
            return t('videoRoutes.summary.video', { video: source.video });
        case 'channel':
            return t('videoRoutes.summary.channel', {
                channel: source.channel,
            });
        case 'color':
            return t('videoRoutes.summary.color', { color: source.color });
    }
}

export function summariseDestination(
    destination: VideoRouteDestination,
): string {
    const idx =
        destination.index !== undefined ? ` [${destination.index}]` : '';
    return `${destination.effectLayer}${idx}`;
}
