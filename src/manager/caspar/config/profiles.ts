import config from '../../../util/_config';
import { Logger } from '../../../util/log';
import { artnetVariants } from './schemas';

export interface Capabilities {
    artnet: 'legacy' | 'v2';
    // Native CasparCG edgeblend config support (gated on capability flag for
    // when the CasparCG edgeblend PR lands). The route-effect edgeblend in
    // src/plugins/internal/edgeblend/ is unrelated and always available.
    edgeblend: boolean;
}

const PROFILES: Record<string, Capabilities> = {
    upstream: { artnet: 'legacy', edgeblend: false },
    lappis: { artnet: 'v2', edgeblend: true },
};

const logger = Logger.scope('Caspar Config');

// Profiles we've already warned about, to avoid spamming the log on every
// parse/serialize when caspar-profile is misconfigured.
const warned = new Set<string>();

export function getProfileName(): string {
    return config['caspar-profile'] ?? 'upstream';
}

// Resolved live from config on each call (no caching): config['caspar-profile']
// is populated by loadConfig() after this module loads, so a cached value would
// risk locking in the default before the file is read. The lookup is cheap.
export function getCapabilities(): Capabilities {
    const name = getProfileName();
    const profile = PROFILES[name];
    if (profile) return profile;

    if (!warned.has(name)) {
        warned.add(name);
        logger.warn(
            `Unknown caspar-profile "${name}", falling back to "upstream"`,
        );
    }
    return PROFILES.upstream;
}

export function getArtnetSchema() {
    return artnetVariants[getCapabilities().artnet];
}
