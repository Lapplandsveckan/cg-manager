import fs from 'fs';
import os from 'os';
import path from 'path';

const ensureDir = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
    return dir;
};

export const pluginFolderName = (pluginName: string) => {
    if (!pluginName) throw new Error('Plugin name is empty');

    return encodeURIComponent(pluginName)
        .replace(/^\./, '%2E')
        .replace(/\.$/, '%2E')
        .replace(/\*/g, '%2A');
};

export const pluginDataDir = (root: string, pluginName: string) =>
    ensureDir(path.join(root, pluginFolderName(pluginName)));

export const pluginTempDir = (pluginName: string) =>
    ensureDir(
        path.join(os.tmpdir(), 'cg-manager', pluginFolderName(pluginName)),
    );

export const resolveInside = (dir: string, segments: string[]) => {
    const resolved = path.resolve(dir, ...segments);
    const relative = path.relative(dir, resolved);
    const leavesDir = relative === '..' || relative.startsWith(`..${path.sep}`);
    if (leavesDir || path.isAbsolute(relative))
        throw new Error(`Path escapes plugin data dir: ${resolved}`);

    return resolved;
};
