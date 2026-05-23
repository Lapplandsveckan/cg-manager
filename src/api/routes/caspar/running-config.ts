import {CasparManager} from '../../../manager';

/**
 * Snapshot of the config CasparCG was started with. Returns `null` when
 * the process isn't running. Edits saved to `config.json` after start
 * don't update this until CasparCG is restarted — this is the
 * "what's actually live" view.
 *
 * Live consumers (preview chips, route blockers) read this; the editor
 * itself reads `caspar/config` so it can show what's about to be applied.
 */
export default {
    'GET': async () => {
        const cfg = CasparManager.getManager().getCasparProcess().getRunningConfig();
        if (!cfg) return null;
        // `_raw` is the parsed XML — not useful to clients and not JSON-safe.
        const {_raw, ...rest} = cfg;
        return rest;
    },
};
