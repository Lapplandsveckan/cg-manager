#!/usr/bin/env node
'use strict';

const { build } = require('../builder');

const args = process.argv.slice(2);

function flag(name) {
    const eq = args.find(a => a.startsWith(`${name}=`));
    if (eq !== undefined) return eq.slice(name.length + 1);

    const i = args.indexOf(name);
    if (i === -1) return undefined;

    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) {
        console.error(`Missing value for ${name}`);
        process.exit(1);
    }
    return value;
}

const [subcommand] = args;

if (subcommand !== 'package') {
    console.error('Usage: cg-manager package [--dest <path>] [--out <name>]');
    process.exit(1);
}

const options = {};

const dest = flag('--dest');
if (dest) options.dest = dest;

const out = flag('--out');
if (out) options.out = out;

build(options).then(ok => process.exit(ok ? 0 : 1)).catch(e => {
    console.error(e);
    process.exit(1);
});
