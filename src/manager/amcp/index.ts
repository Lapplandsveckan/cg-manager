import {LogExecutor} from './test';
import {TLSCommand} from './commands/tls';
import {PlayCommand} from './commands/play';
import {Color} from './commands/loadbg';

export function testColorLayers() {
    const executor = new LogExecutor();
    const channel = executor.allocateChannel(1);
    const layer = channel.allocateLayer();
    executor.executeAllocations();

    const layer2 = channel.allocateLayer(0);
    executor.executeAllocations();

    const command = PlayCommand.color(Color.RGBA(255, 0, 0)).allocate(layer);
    executor.execute(command);

    const command2 = PlayCommand.color(Color.RGBA(0, 255, 0)).allocate(layer2);
    executor.execute(command2);

    TLSCommand.getTemplates(executor).then(templates => {
        console.log('templates', templates);
    });
}