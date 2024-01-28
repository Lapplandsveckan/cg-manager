import {LogExecutor} from './test';
import {ColorCommand} from './commands/color';

export function testColorLayers() {
    const executor = new LogExecutor();
    const channel = executor.allocateChannel(1);
    const layer = channel.allocateLayer();
    executor.executeAllocations();

    const layer2 = channel.allocateLayer(0);
    executor.executeAllocations();

    const command = new ColorCommand(ColorCommand.RGBA(255, 0, 0)).allocate(layer);
    executor.execute(command);

    const command2 = new ColorCommand(ColorCommand.RGBA(0, 255, 0)).allocate(layer2);
    executor.execute(command2);
}