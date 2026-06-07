// This script is replaced by a static require statement in the compiled code.

import path from 'path';
import { loadPluginFolder } from './util';

const files = loadPluginFolder(path.join(__dirname, 'internal'));
export default files;
