import {
    type Consumers,
    type Transform,
    type SchemaNode,
    type NamedArray,
} from './types';
import { schemas } from './schemas';
import { getArtnetSchema } from './profiles';

const utils = {
    filterDefined: (obj: Record<string, unknown>): Record<string, unknown> =>
        Object.fromEntries(
            Object.entries(obj).filter(([, v]) => v !== undefined),
        ),
    escape: (value: unknown): unknown =>
        Array.isArray(value) ? value[0] : value,

    camelCase: (str: string) =>
        str.replace(/-([a-z])/g, g => g[1].toUpperCase()),
    hyphenate: (str: string) =>
        str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),

    keyMap: (
        obj: Record<string, unknown>,
        map: (key: string) => string,
    ): Record<string, unknown> =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [map(k), v])),
    valueMap: (
        obj: Record<string, unknown>,
        map: (value: unknown, key: string) => unknown,
    ): Record<string, unknown> =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, map(v, k)])),

    defaultSerialize: (
        value: unknown,
        schema: SchemaNode | undefined,
    ): unknown => {
        if (schema === undefined) return value;

        if (Array.isArray(schema)) {
            const name = (schema as NamedArray<SchemaNode>)._name;
            const items = ((value as unknown[] | undefined) ?? []).map(v =>
                utils.defaultSerialize(v, schema[0]),
            );
            // xml2js Builder turns {name: [...]} into <name>...</name> repeated
            // for each item — the inverse of how the parse branch reads them.
            return { [name]: items };
        }

        if (typeof value !== 'object') return value;

        const objSchema = schema as Record<string, SchemaNode>;
        let next = utils.keyMap(
            value as Record<string, unknown>,
            utils.hyphenate,
        );
        next = utils.valueMap(next, (v, k) =>
            utils.defaultSerialize(v, objSchema?.[k]),
        );
        return utils.filterDefined(next);
    },
    defaultParse: (value: unknown, schema: SchemaNode | undefined): unknown => {
        if (schema === undefined) return value;

        if (Array.isArray(schema)) {
            // xml2js gives `<parent><name>a</name><name>b</name></parent>` as
            // `[{name: [a, b]}]`. Unwrap the outer single-element array, pull
            // the inner item list, and parse each item against schema[0].
            const wrapper = Array.isArray(value) ? value[0] : value;
            const name = (schema as NamedArray<SchemaNode>)._name;
            const inner = (wrapper as Record<string, unknown> | undefined)?.[
                name
            ];
            if (!Array.isArray(inner)) return [];
            return inner.map(v => utils.defaultParse(v, schema[0]));
        }

        const escaped = utils.escape(value);

        const t = typeof schema;
        if (t === 'number') return parseFloat(escaped as string);
        if (t === 'boolean') return escaped === 'true';
        if (t === 'string')
            return escaped == null ? undefined : String(escaped);

        const objSchema = schema as Record<string, SchemaNode>;
        let next = utils.keyMap(
            escaped as Record<string, unknown>,
            utils.camelCase,
        );
        next = utils.valueMap(next, (v, k) =>
            utils.defaultParse(v, objSchema?.[k]),
        );
        return next;
    },
};

export const transforms = {
    decklink: {
        parse: value => utils.defaultParse(value, schemas.decklink),
        serialize: value => utils.defaultSerialize(value, schemas.decklink),
    } as Transform<Consumers['decklink']>,
    bluefish: {
        parse: value => utils.defaultParse(value, schemas.bluefish),
        serialize: value => utils.defaultSerialize(value, schemas.bluefish),
    } as Transform<Consumers['bluefish']>,
    'system-audio': {
        parse: value => utils.defaultParse(value, schemas['system-audio']),
        serialize: value =>
            utils.defaultSerialize(value, schemas['system-audio']),
    } as Transform<Consumers['system-audio']>,

    screen: {
        parse: value => utils.defaultParse(value, schemas.screen),
        serialize: value => utils.defaultSerialize(value, schemas.screen),
    } as Transform<Consumers['screen']>,
    ndi: {
        parse: value => utils.defaultParse(value, schemas.ndi),
        serialize: value => utils.defaultSerialize(value, schemas.ndi),
    } as Transform<Consumers['ndi']>,
    ffmpeg: {
        parse: value => utils.defaultParse(value, schemas.ffmpeg),
        serialize: value => utils.defaultSerialize(value, schemas.ffmpeg),
    } as Transform<Consumers['ffmpeg']>,
    artnet: {
        // Variant resolved live from caspar-profile on each call (see profiles.ts).
        parse: value => utils.defaultParse(value, getArtnetSchema()),
        serialize: value => utils.defaultSerialize(value, getArtnetSchema()),
    } as Transform<Consumers['artnet']>,
    // Left as `Transform<any>`: this map is heterogeneous over `Consumers`, and
    // `Transform<unknown>` isn't assignable to it — `serialize` is contravariant
    // in T, so `Transform<unknown>`'s serialize can't stand in for one that
    // expects a concrete `Consumers[K]`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as Record<string, Transform<any>>;
