import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { should, suite, test } from './utility';
import {
    pluginDataDir,
    pluginFolderName,
    resolveInside,
} from '../src/pluginDirs';

should;

@suite
class PluginDirsTests {
    @test
    'folder name is filesystem safe'() {
        const name = pluginFolderName('../evil/name');
        expect(name).to.not.include('/');
    }

    @test
    'folder name never resolves to a dot segment'() {
        for (const name of ['.', '..', 'a.', '.hidden', 'a*b'])
            expect(pluginFolderName(name)).to.not.match(/^\.|\.$|\*/);
    }

    @test
    'folder name rejects empty'() {
        expect(() => pluginFolderName('')).to.throw();
    }

    @test
    'data dir is created under root'() {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-'));
        const dir = pluginDataDir(root, 'demo');
        const created = fs.existsSync(dir);
        fs.rmSync(root, { recursive: true, force: true });

        expect(dir).to.equal(path.join(root, 'demo'));
        expect(created).to.equal(true);
    }

    @test
    'resolveInside joins nested segments'() {
        const dir = path.join(os.tmpdir(), 'x');
        expect(resolveInside(dir, ['a', 'b.json'])).to.equal(
            path.join(dir, 'a', 'b.json'),
        );
    }

    @test
    'resolveInside allows names starting with dots'() {
        const dir = path.join(os.tmpdir(), 'x');
        expect(resolveInside(dir, ['..config.json'])).to.equal(
            path.join(dir, '..config.json'),
        );
    }

    @test
    'resolveInside rejects traversal'() {
        const dir = path.join(os.tmpdir(), 'x');
        expect(() => resolveInside(dir, ['..', 'y'])).to.throw();
        expect(() => resolveInside(dir, ['/etc/passwd'])).to.throw();
    }
}
