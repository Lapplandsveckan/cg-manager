import {
    BUILTIN_SOURCE_TYPES,
    isBuiltinSource,
    type RouteSourceTypeInfo,
    type VideoRouteSource,
    type VideoRouteDestination,
} from './api';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A contributed type names its own label, as an i18next key from the
 *  contributing plugin's namespace or as a plain string. */
export function sourceTypeLabel(
    t: Translate,
    type: string,
    contributed: RouteSourceTypeInfo[],
): string {
    if (BUILTIN_SOURCE_TYPES.includes(type as never))
        return t(`sourceTypes.${type}`);

    const info = contributed.find(entry => entry.type === type);
    if (!info) return type;

    return t(info.label, { defaultValue: info.label });
}

export function summariseSource(
    t: Translate,
    source: VideoRouteSource,
    contributed: RouteSourceTypeInfo[] = [],
): string {
    if (!isBuiltinSource(source))
        return sourceTypeLabel(t, source.type, contributed);

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
