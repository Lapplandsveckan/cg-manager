import {CasparManager} from '../../../../manager';
import {isInternalMediaId} from '../../../../manager/scanner/folders';

export default {
    'GET': async (request) => {
        return CasparManager
            .getManager()
            .getMediaScanner()
            .getDatabase()
            .allDocs()
            .map(doc => doc.id)
            // Hide plugin-side symlinks under `_internal/`. The scanner's
            // own :8000 endpoints still expose them so CasparCG can play
            // them; this filter is UI-only.
            .filter(id => !isInternalMediaId(id));
    },
};