import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';

import enCommon from './locales/en/common.json';

// Client-side i18next init. Locale JSON is bundled into the webpack output
// (no /locales HTTP route), which keeps the packaged binary self-contained.
// To add a locale: drop a folder under src/web/src/lib/locales, import its
// common.json below, add it to `resources`, and extend `supportedLngs` here
// + the `locales` array in next-i18next.config.js (Next routing).
if (!i18n.isInitialized) i18n
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en'],
        defaultNS: 'common',
        ns: ['common'],
        resources: {
            en: { common: enCommon },
        },
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
