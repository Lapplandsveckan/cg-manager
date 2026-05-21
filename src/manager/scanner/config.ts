import managerConfig from '../../util/config';
import * as path from 'path';

// Media / template / font folders live next to the CasparCG binary (that's
// where the running caspar reads from). The manager itself can sit anywhere,
// so we resolve these relative to `caspar-path` at access time. Falls back
// to cwd when `caspar-path` isn't set (i.e. dev mode running from the same
// folder as caspar).
function casparRelative(dir: string): string {
    const root = managerConfig['caspar-path'] || process.cwd();
    return path.join(root, dir);
}

const Config = {
    paths: {
        get template() { return casparRelative('template'); },
        get media()    { return casparRelative('media'); },
        get font()     { return casparRelative('font'); },
    },
};

export default Config;