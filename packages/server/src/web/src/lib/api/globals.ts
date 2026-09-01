import React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as ReactJSXDevRuntime from 'react/jsx-dev-runtime';
import * as material from '@mui/material';
import * as MUIColorInput from 'mui-color-input';
import * as ReactI18next from 'react-i18next';
import * as weblib from '../';
import i18n from '../i18n';

// Fills the `window` globals the plugin UI runtime webpack (manager/plugins/ui.ts)
// externalizes React, MUI, i18n and @web-lib to. Kept out of lib/api/inject.ts —
// which is itself part of the @web-lib barrel — so this side-effect-only module
// (and its @mui/material / react-i18next / JSON-importing dependencies) never
// enters the declaration-emit graph used to publish @web-lib's types.
if (typeof window !== 'undefined') {
    window['React'] = React;
    window['ReactDOM'] = ReactDOM;
    window['MaterialUI'] = material;
    window['MUIColorInput'] = MUIColorInput;
    window['WebLib'] = weblib;
    window['i18n'] = i18n;
    window['ReactI18next'] = ReactI18next;

    // Submodule specifiers webpack won't externalize on its own: pre-built
    // dependencies (e.g. @mui/icons-material) import the automatic JSX runtime
    // directly rather than going through the 'react' entry point externalized
    // above, and plugins reach for 'react-dom/client' to mount their own roots.
    // Without these it'd bundle whatever 'react' happens to resolve on disk in
    // that dependency's own node_modules and call into its real internals,
    // which only line up if that's the same React version/instance as
    // `window.React`.
    window['ReactJSXRuntime'] = ReactJSXRuntime;
    window['ReactJSXDevRuntime'] = ReactJSXDevRuntime;
    window['ReactDOMClient'] = ReactDOMClient;
}
