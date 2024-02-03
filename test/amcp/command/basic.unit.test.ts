import {should, suite, test} from '../../utility';
import {BasicCommand, RawCommand} from '../../../src/manager/amcp/command';
import {expect} from 'chai';

should;
@suite class BasicCommandUnitTests {
    before() {
    }

    @test 'raw command working'() {
        const text = 'TEST A B C';
        const cmd = new RawCommand(text);
        expect(cmd.getCommand()).to.equal(text);
    }

    @test 'raw command interpret'() {
        const text = 'TEST "A B" C\r\n';
        const cmd = BasicCommand.from(text);
        expect(cmd.getCommand()).to.equal(text);
    }

    @test 'basic command interpret'() {
        const text = 'TEST A "B C D"\r\nPLAY 1-3 "test.mp4" LOOP\r\nPLAY 1-3 "testing this.mp4" SEEK 10\r\n';
        const cmds = BasicCommand.interpret(text);

        expect(cmds.length).to.equal(3);

        expect(cmds[0].getCmd()).to.equal('TEST');
        expect(cmds[0].getArgs()).to.deep.equal(['A', 'B C D']);

        expect(cmds[1].getCmd()).to.equal('PLAY');
        expect(cmds[1].getArgs()).to.deep.equal(['1-3', 'test.mp4', 'LOOP']);

        expect(cmds[2].getCmd()).to.equal('PLAY');
        expect(cmds[2].getArgs()).to.deep.equal(['1-3', 'testing this.mp4', 'SEEK', '10']);
    }
}