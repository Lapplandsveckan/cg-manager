import { type TFunction } from 'i18next';
import { type RecordData } from '../../components/config/fields';

interface DescribableConsumer {
    type: string;
    data?: RecordData;
}

// One-line, plain-language summary for a consumer row in simple mode —
// replaces the advanced `key=value · key=value` monospace dump with copy a
// non-technical operator can read at a glance.
export function describeConsumer(
    consumer: DescribableConsumer,
    t: TFunction,
): string {
    const data = consumer.data ?? {};

    switch (consumer.type) {
        case 'screen': {
            const monitor = t('config.simple.summary.screenMonitor', {
                device: data.device ?? 1,
            });
            const mode = data.windowed
                ? t('config.simple.summary.screenWindowed')
                : t('config.simple.summary.screenFullscreen');
            return `${monitor} · ${mode}`;
        }
        case 'decklink':
            return t('config.simple.summary.decklinkCard', {
                device: data.device ?? 1,
            });
        case 'ndi':
            return data.name
                ? t('config.simple.summary.ndiName', { name: data.name })
                : t('config.simple.summary.none');
        case 'system-audio': {
            const layout = data.channelLayout as string | undefined;
            return layout
                ? t(`config.simple.summary.layouts.${layout}`, {
                      defaultValue: layout,
                  })
                : t('config.simple.summary.none');
        }
        case 'artnet': {
            const count = Array.isArray(data.fixtures)
                ? data.fixtures.length
                : 0;
            return t('config.simple.summary.artnetFixtures', { count });
        }
        default:
            return t('config.simple.summary.none');
    }
}
