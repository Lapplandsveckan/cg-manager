import {should, suite, test} from '../../utility';
import {BasicCommand, RawCommand} from '../../../src/manager/amcp/command';
import {expect} from 'chai';
import {MockExecutor} from '../../utility/command/executor.mock';

should;
@suite class BasicCommandUnitTests {
    before() {
    }

    @test 'test send'() {
        const text = 'TEST A "B C D"\r\n';
        const executor = new MockExecutor();
        executor.on('send', (data) => {
            expect(data).to.equal(text);
        });

        const cmd = new RawCommand(text);
        executor.executePassive(cmd);
    }

    @test 'basic response'() {
        const executor = new MockExecutor();
        executor.on('event', ({ code, cmd, data }) => {
            expect(code).to.equal(202);
            expect(cmd).to.equal('TEST');
            expect(data.length).to.equal(0);
        });

        executor.receive('202 TEST\r\n');
    }

    @test 'one line response'() {
        const executor = new MockExecutor();
        executor.on('event', ({ code, cmd, data }) => {
            expect(code).to.equal(201);
            expect(cmd).to.equal('TEST');
            expect(data.length).to.equal(1);
            expect(data[0]).to.equal('A BC D');
        });

        executor.receive('201 TEST\r\nA BC D\r\n');
    }

    @test 'multi line response'() {
        const executor = new MockExecutor();
        executor.on('event', ({ code, cmd, data }) => {
            expect(code).to.equal(200);
            expect(cmd).to.equal('TEST');
            expect(data.length).to.equal(2);
            expect(data[0]).to.equal('A BC D');
            expect(data[1]).to.equal('E F G');
        });

        executor.receive('200 TEST\r\nA BC D\r\nE F G\r\n\r\n');
    }

    @test 'partial response'() {
        const executor = new MockExecutor();
        executor.on('event', ({ code, cmd, data }) => {
            expect(code).to.equal(200);
            expect(cmd).to.equal('TEST');
            expect(data.length).to.equal(2);
            expect(data[0]).to.equal('A BC D');
            expect(data[1]).to.equal('E F G');
        });

        executor.receive('200 TEST\r\nA BC D\r\n');
        executor.receive('E F G\r\n\r\n');
    }

    @test async 'input and response'() {
        const text = 'TEST A "B C D"\r\n';
        const executor = new MockExecutor();
        executor.on('send', (data) => {
            expect(data).to.equal(text);
            executor.receive('202 TEST\r\n');
        });

        const cmd = new RawCommand(text);
        const response = await executor.execute(cmd);
        const data = response[0];

        expect(data.code).to.equal(202);
        expect(data.data.length).to.equal(0);
    }

    @test async 'input and response with multiple commands'() {
        const text = 'TEST A "B C D"\r\nPLAY 1-3 "test.mp4" LOOP\r\n';
        const executor = new MockExecutor();
        executor.on('send', (data) => {
            expect(data).to.equal(text);

            const cmds = BasicCommand.interpret(data);
            expect(cmds.length).to.equal(2);

            executor.receive('202 TEST\r\n201 PLAY\r\nPlaying 1-3 test.mp4\r\n');
        });

        const cmd = new RawCommand(text);
        const response = await executor.execute(cmd);

        expect(response.length).to.equal(2);

        expect(response[0].code).to.equal(202);
        expect(response[0].data.length).to.equal(0);

        expect(response[1].code).to.equal(201);
        expect(response[1].data.length).to.equal(1);
        expect(response[1].data[0]).to.equal('Playing 1-3 test.mp4');
    }
}