import { noTryAsync } from 'no-try';
import { BasicCommand } from './command';
import { type CommandExecutor } from './executor';

export interface Consumer {
    readonly index: number;
    remove(): Promise<void>;
}

// Above CasparCG's configured consumers, below the ffmpeg consumer's default 100000+ range
const FIRST_CONSUMER_INDEX = 10000;

const lowestFreeIndex = (used: Set<number>) => {
    let index = FIRST_CONSUMER_INDEX;
    while (used.has(index)) index++;
    return index;
};

const removeCommand = (casparChannel: number, index: number) =>
    BasicCommand.construct('REMOVE', `${casparChannel}-${index}`);

export async function addConsumer(
    executor: CommandExecutor,
    casparChannel: number,
    used: Set<number>,
    params: string[],
): Promise<Consumer> {
    const index = lowestFreeIndex(used);
    used.add(index);

    const [addError] = await noTryAsync(() =>
        executor.execute(
            BasicCommand.construct(
                'ADD',
                `${casparChannel}-${index}`,
                ...params,
            ),
        ),
    );

    if (addError) {
        await noTryAsync(() =>
            executor.execute(removeCommand(casparChannel, index)),
        );
        used.delete(index);
        throw addError;
    }

    let removed = false;
    const remove = async () => {
        if (removed) return;
        removed = true;
        used.delete(index);
        await executor.execute(removeCommand(casparChannel, index));
    };

    return { index, remove };
}
