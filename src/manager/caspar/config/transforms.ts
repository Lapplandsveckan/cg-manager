import {type Consumers, type Transform} from './types';
import {schemas} from './schemas';

const utils = {
    filterDefined: (obj: Record<string, any>) =>
        Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)),
    escape: (value: any) => Array.isArray(value) ? value[0] : value,

    camelCase: (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase()),
    hyphenate: (str: string) => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),

    keyMap: (obj: Record<string, any>, map: (key: string) => string) =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [map(k), v])),
    valueMap: (obj: Record<string, any>, map: (value: any, key: string) => any) =>
        Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, map(v, k)])),

    defaultSerialize: (value: any, schema: any) => {
        if (schema === undefined)
            return value;

        if (Array.isArray(schema)) {
            const name = (schema as any)._name;
            const items = (value ?? []).map((v: any) => utils.defaultSerialize(v, schema[0]));
            // xml2js Builder turns {name: [...]} into <name>...</name> repeated
            // for each item — the inverse of how the parse branch reads them.
            return {[name]: items};
        }

        if (typeof value !== 'object')
            return value;

        value = utils.keyMap(value, utils.hyphenate);
        value = utils.valueMap(value, (v, k) => utils.defaultSerialize(v, schema?.[k]));
        value = utils.filterDefined(value);
        return value;
    },
    defaultParse: (value: any, schema: any) => {
        if (schema === undefined)
            return value;

        if (Array.isArray(schema)) {
            // xml2js gives `<parent><name>a</name><name>b</name></parent>` as
            // `[{name: [a, b]}]`. Unwrap the outer single-element array, pull
            // the inner item list, and parse each item against schema[0].
            const wrapper = Array.isArray(value) ? value[0] : value;
            const name = (schema as any)._name;
            const inner = wrapper?.[name];
            if (!Array.isArray(inner)) return [];
            return inner.map((v: any) => utils.defaultParse(v, schema[0]));
        }

        value = utils.escape(value);

        const t = typeof schema;
        if (t === 'number') return parseFloat(value);
        if (t === 'boolean') return value === 'true';
        if (t === 'string') return value.toString();

        value = utils.keyMap(value, utils.camelCase);
        value = utils.valueMap(value, (v, k) => utils.defaultParse(v, schema?.[k]));
        return value;
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
        serialize: value => utils.defaultSerialize(value, schemas['system-audio']),
    } as Transform<Consumers['system-audio']>,

    screen: {
        parse: value => utils.defaultParse(value, schemas.screen),
        serialize: value => utils.defaultSerialize(value, schemas.screen),
    } as Transform<Consumers['screen']>,
    'ndi': {
        parse: value => utils.defaultParse(value, schemas.ndi),
        serialize: value => utils.defaultSerialize(value, schemas.ndi),
    } as Transform<Consumers['ndi']>,
    'ffmpeg': {
        parse: value => utils.defaultParse(value, schemas.ffmpeg),
        serialize: value => utils.defaultSerialize(value, schemas.ffmpeg),
    } as Transform<Consumers['ffmpeg']>,
    'artnet': {
        parse: value => utils.defaultParse(value, schemas.artnet),
        serialize: value => utils.defaultSerialize(value, schemas.artnet),
    } as Transform<Consumers['artnet']>,
} as Record<string, Transform<any>>;
