/** @type {import('next').NextConfig} */
// mui-color-input ships pure ESM that imports `@mui/material/Button` (a
// directory). Node's native ESM loader can't resolve that on its own, which
// breaks SSR. Letting Next transpile the package through webpack rewrites
// those imports to concrete files.
module.exports = {
    transpilePackages: ['mui-color-input'],
};
