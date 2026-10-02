import { expect } from 'chai';
import { should, suite, test } from '../utility';
import { Channel } from '../../src';
import { MockExecutor } from '../utility/command/executor.mock';

class StubExecutor extends MockExecutor {
    public sent: string[] = [];
    public failing = new Set<string>();

    public execute(command: any) {
        const line = `${command.getCmd()} ${command.getArgs().join(' ')}`;
        this.sent.push(line);
        const failed = [...this.failing].some(prefix =>
            line.startsWith(prefix),
        );
        return failed
            ? Promise.reject(new Error(line))
            : Promise.resolve({} as any);
    }
}

should;
@suite
class ConsumerUnitTests {
    private executor: StubExecutor;
    private channel: Channel;

    before() {
        this.executor = new StubExecutor();
        this.channel = new Channel(1, this.executor);
    }

    @test async 'sequential adds get increasing indices'() {
        const a = await this.channel.addConsumer('FILE', 'a.mp4');
        const b = await this.channel.addConsumer('FILE', 'b.mp4');

        expect(a.index).to.equal(10000);
        expect(b.index).to.equal(10001);
        expect(this.executor.sent[0]).to.equal('ADD 1-10000 FILE a.mp4');
    }

    @test async 'concurrent adds get distinct indices'() {
        const consumers = await Promise.all([
            this.channel.addConsumer('FILE', 'a.mp4'),
            this.channel.addConsumer('FILE', 'b.mp4'),
            this.channel.addConsumer('FILE', 'c.mp4'),
        ]);

        const indices = new Set(consumers.map(c => c.index));
        expect(indices.size).to.equal(3);
    }

    @test async 'remove frees the index for reuse'() {
        const a = await this.channel.addConsumer('FILE', 'a.mp4');
        await a.remove();
        const b = await this.channel.addConsumer('FILE', 'b.mp4');

        expect(b.index).to.equal(a.index);
        expect(this.executor.sent).to.include('REMOVE 1-10000');
    }

    @test async 'remove only sends one REMOVE'() {
        const a = await this.channel.addConsumer('FILE', 'a.mp4');
        await a.remove();
        await a.remove();

        const removes = this.executor.sent.filter(s => s.startsWith('REMOVE'));
        expect(removes.length).to.equal(1);
    }

    @test async 'failed remove still frees the index'() {
        const a = await this.channel.addConsumer('FILE', 'a.mp4');
        this.executor.failing.add('REMOVE');

        let error: Error | undefined;
        await a.remove().catch(e => (error = e));
        const b = await this.channel.addConsumer('FILE', 'b.mp4');

        expect(error).to.be.instanceOf(Error);
        expect(b.index).to.equal(a.index);
    }

    @test async 'index stays reserved while a failed add cleans up'() {
        let finishCleanup: () => void;
        const cleanup = new Promise<void>(resolve => (finishCleanup = resolve));
        const execute = this.executor.execute.bind(this.executor);
        this.executor.execute = (command: any) => {
            const line = `${command.getCmd()} ${command.getArgs().join(' ')}`;
            if (line.startsWith('ADD 1-10000'))
                return Promise.reject(new Error('ADD failed'));
            if (line.startsWith('REMOVE 1-10000'))
                return cleanup.then(() => execute(command));
            return execute(command);
        };

        const failed = this.channel
            .addConsumer('FILE', 'a.mp4')
            .catch(() => undefined);
        const second = await this.channel.addConsumer('FILE', 'b.mp4');
        finishCleanup();
        await failed;

        expect(second.index).to.equal(10001);
    }

    @test async 'failed add cleans up and frees the index'() {
        this.executor.failing.add('ADD');

        let error: Error | undefined;
        await this.channel
            .addConsumer('FILE', 'a.mp4')
            .catch(e => (error = e));
        this.executor.failing.clear();
        const b = await this.channel.addConsumer('FILE', 'b.mp4');

        expect(error).to.be.instanceOf(Error);
        expect(this.executor.sent).to.include('REMOVE 1-10000');
        expect(b.index).to.equal(10000);
    }
}
