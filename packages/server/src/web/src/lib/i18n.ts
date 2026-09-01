import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import svCommon from './locales/sv/common.json';

// Client-side i18next init. Locale JSON is bundled into the webpack output
// (no /locales HTTP route), which keeps the packaged binary self-contained.
// To add a locale: drop a folder under src/web/src/lib/locales, import its
// common.json below, add it to `resources`, and extend `supportedLngs` here.
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
        ns: ['common'],
        resources: {
            en: { common: enCommon },
            sv: { common: svCommon },
        },
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
