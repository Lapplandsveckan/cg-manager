export const pluginHttpUrl = (pluginName: string, subPath = '') =>
    `/api/plugin-http/${encodeURIComponent(pluginName)}/${subPath.replace(/^\/+/, '')}`;
