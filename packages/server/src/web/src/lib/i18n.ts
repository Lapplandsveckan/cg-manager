import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enEdgeblend from './locales/en/edgeblend.json';
import enRecorder from './locales/en/recorder.json';
import enRoutes from './locales/en/routes.json';
import svCommon from './locales/sv/common.json';
import svEdgeblend from './locales/sv/edgeblend.json';
import svRecorder from './locales/sv/recorder.json';
import svRoutes from './locales/sv/routes.json';

// Client-side i18next init. Locale JSON is bundled into the webpack output
// (no /locales HTTP route), which keeps the packaged binary self-contained.
// Each internal plugin has its own namespace file next to common.json.
// To add a locale: drop a folder under src/web/src/lib/locales with every
// namespace file, import them below, add them to `resources`, and extend
// `supportedLngs` here.
//
// Passing `resources` inline is also what makes init synchronous — i18next only
// defers to a setTimeout when resources have to be fetched. Swap to a backend
// loader and the first SSR render emits raw keys ("brand.name" instead of
// "CG Manager"), which shows up as a hydration mismatch.
if (!i18n.isInitialized)
    i18n.use(initReactI18next).init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'sv'],
        defaultNS: 'common',
        ns: ['common', 'routes', 'edgeblend', 'recorder'],
        resources: {
            en: {
                common: enCommon,
                routes: enRoutes,
                edgeblend: enEdgeblend,
                recorder: enRecorder,
            },
            sv: {
                common: svCommon,
                routes: svRoutes,
                edgeblend: svEdgeblend,
                recorder: svRecorder,
            },
        },
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
