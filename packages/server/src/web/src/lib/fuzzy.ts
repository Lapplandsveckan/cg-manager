import Fuse, { type FuseOptionKey } from 'fuse.js';

// Strips Fuse's extended-search operators so raw input can't be read as a query DSL
export function toFuzzyTokens(query: string): string {
    return query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map(token => token.replace(/['!^=$|]/g, ''))
        .join(' ');
}

export function createFuzzy<T>(items: T[], keys: FuseOptionKey<T>[]) {
    const fuse = new Fuse(items, {
        keys,
        threshold: 0.4,
        ignoreLocation: true,
        useExtendedSearch: true,
    });

    return (query: string): T[] => {
        const needle = toFuzzyTokens(query);
        if (!needle) return items;
        return fuse.search(needle).map(result => result.item);
    };
}
