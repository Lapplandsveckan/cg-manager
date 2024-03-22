import {Consumers, Transform} from './types';
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

    array: (arr: any, name: string) => arr?.map((v: any) => ({[name]: v})),

    defaultSerialize: (value: any, schema: any) => {
        if (schema === undefined)
            return value;

        if (typeof value !== 'object')
            return value;

        if (Array.isArray(schema))
            return utils.array(value.map((v: any) => utils.defaultSerialize(v, schema[0])), schema[0]._name);

        value = utils.keyMap(value, utils.hyphenate);
        value = utils.valueMap(value, (v, k) => utils.defaultSerialize(v, schema?.[k]));
        value = utils.filterDefined(value);
        return value;
    },
    defaultParse: (value: any, schema: any) => {
        if (schema === undefined)
            return value;

        if (Array.isArray(schema))
            return value.map((v: any) => utils.defaultParse(v[schema[0]._name], schema[0]));

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