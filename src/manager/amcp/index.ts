import {LogExecutor} from './test';
import {VideoEffect} from "./effects/video";

export async function testColorLayers() {
    const executor = new LogExecutor();
    const channel = executor.allocateChannel(1);

    const groupA = channel.createGroup('A');
    const groupB = channel.createGroup('B');

    const effectA = new VideoEffect('A', groupA, { disposeOnStop: true });
    await effectA.activate(true);

    const effectB = new VideoEffect('B', groupB, { disposeOnStop: true });
    await effectB.activate(true);

    const effectC = new VideoEffect('C', groupA, { disposeOnStop: true });
    await effectC.activate(true);


    setTimeout(() => {
        effectA.deactivate();
        effectB.deactivate();
        effectC.deactivate();
    }, 3000);
}