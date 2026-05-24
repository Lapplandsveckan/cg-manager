/** @type {import('next').NextConfig} */
// mui-color-input ships pure ESM that imports `@mui/material/Button` (a
// directory). Node's native ESM loader can't resolve that on its own, which
// breaks SSR. Letting Next transpile the package through webpack rewrites
// those imports to concrete files.
const { i18n } = require('./next-i18next.config');

module.exports = {
    i18n,
    transpilePackages: ['mui-color-input'],
    logging: {
        // Silences the dev " GET /path 200 in Nms" access log lines. Only
        // available in Next 15+ — for older versions you'd have to filter
        // stdout manually.
        incomingRequests: false,
    },
    async redirects() {
        return [
            {source: '/', destination: '/play', permanent: false},
        ];
    },
};
