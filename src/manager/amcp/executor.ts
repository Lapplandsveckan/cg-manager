import {Channel} from './layers';
import {Command} from './command';

export class CommandExecutor {
    public execute(command: Command) {

    }

    public channels = new Map<number, Channel>();

    public getChannel(casparChannel: number) {
        return this.channels.get(casparChannel);
    }

    public getChannels() {
        return Array.from(this.channels.values());
    }

    public allocateChannel(casparChannel: number) {
        const channel = new Channel(casparChannel, this);
        this.channels.set(casparChannel, channel);

        return channel;
    }

    public executeAllocations() {
        for (const channel of this.channels.values())
            channel.executeAllocation();
    }
}