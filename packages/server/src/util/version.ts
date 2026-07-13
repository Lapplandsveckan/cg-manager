import path from 'path';
import { noTry } from 'no-try';

const [, pkg] = noTry(() =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require(path.join(__dirname, '../../package.json')),
);
export const version: string =
    (pkg as { version?: string } | undefined)?.version ?? '0.0.0';
