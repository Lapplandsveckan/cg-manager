import type { VideoRouteSource, VideoRouteDestination } from './api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function summariseSource(
    t: Translate,
    source: VideoRouteSource,
): string {
    switch (source.type) {
        case 'decklink':
            return source.keyDevice !== undefined
                ? t('summary.decklinkWithKey', {
                      device: source.device,
                      key: source.keyDevice,
                  })
                : t('summary.decklink', { device: source.device });
        case 'video':
            return t('summary.video', { video: source.video });
        case 'channel':
            return t('summary.channel', {
                channel: source.channel,
            });
        case 'color':
            return t('summary.color', { color: source.color });
    }
}

export function summariseDestination(
    destination: VideoRouteDestination,
): string {
    const idx =
        destination.index !== undefined ? ` [${destination.index}]` : '';
    return `${destination.effectLayer}${idx}`;
}
