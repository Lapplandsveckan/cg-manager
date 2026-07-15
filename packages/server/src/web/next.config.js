/** @type {import('next').NextConfig} */
// mui-color-input ships pure ESM that imports `@mui/material/Button` (a
// directory). Node's native ESM loader can't resolve that on its own, which
// breaks SSR. Letting Next transpile the package through webpack rewrites
// those imports to concrete files.
//
// react-i18next / i18next are dual ESM+CJS. Next's server build externalizes
// them as `module.exports = import("react-i18next")` — a raw dynamic import().
// Inside the pkg snapshot, pkg's bootstrap Module._compile compiles that bundle
// with no importModuleDynamically callback, so the import() throws
// ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING on first SSR. Transpiling them forces
// webpack to bundle them in (as require()) instead of emitting import().
const path = require('path');
const { i18n } = require('./next-i18next.config');

module.exports = {
    i18n,
    // Standalone tracing (@vercel/nft) computes the exact SSR runtime
    // dependency closure into .next/standalone/node_modules. The packaging
    // pipeline reads that closure to decide which node_modules packages to
    // bundle into the pkg snapshot instead of shipping all of node_modules.
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname, '../../../..'),
    transpilePackages: ['mui-color-input', 'react-i18next', 'i18next'],
    logging: {
        // Silences the dev " GET /path 200 in Nms" access log lines. Only
        // available in Next 15+ — for older versions you'd have to filter
        // stdout manually.
        incomingRequests: false,
    },
    async redirects() {
        return [{ source: '/', destination: '/play', permanent: false }];
    },
};
