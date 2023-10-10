import {LayerManager} from './layers';
import {ColorEffect} from './effects/color';

export function testColorLayers() {
    const manager = new LayerManager(1);

    const layer = manager.allocateLayer(0, true);
    const color = new ColorEffect(ColorEffect.RGBA(10, 170, 230));
    layer.addEffect(color, true);

    const layer2 = manager.allocateLayer(0, true);
    const color2 = new ColorEffect(ColorEffect.RGBA(230, 130, 20));
    layer2.addEffect(color2, true);

    manager.deallocateLayers([layer], true);
}