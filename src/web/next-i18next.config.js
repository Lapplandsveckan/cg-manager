/** @type {import('next-i18next').UserConfig} */
// All pages here are client-rendered (no getServerSideProps / getStaticProps),
// so instead of wiring serverSideTranslations into each page we let i18next
// fetch /locales/{{lng}}/{{ns}}.json at runtime via i18next-http-backend.
// Adding a new locale: drop a folder in public/locales and add the code to
// `locales` below.
module.exports = {
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'sv'],
    },
    localePath: './public/locales',
    serializeConfig: false,
    reloadOnPrerender: process.env.NODE_ENV !== 'production',
};
