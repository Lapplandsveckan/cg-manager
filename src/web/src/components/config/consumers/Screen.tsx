import {ConsumerConfig} from '../Consumer';
import {BooleanInput, EnumInput, NumberInput} from '../Input';
import {schemas} from '../../../../../manager/caspar/config/schemas';
import {Stack} from '@mui/material';

export const ScreenConsumerConfig: ConsumerConfig = ({ consumer, onSave, onDelete }) => {
    const data = consumer.data as typeof schemas['screen'];
    return (
        <ConsumerConfig
            consumer={consumer}
            onSave={() => onSave(consumer)} // TODO: Implement onSave
            onDelete={onDelete}
        >
            <NumberInput onChange={val => console.log(val)} label="Device" value={data.device} defaultValue={1} />
            <EnumInput onChange={val => console.log(val)} label="Aspect Ratio" value={data.aspectRatio} options={['4:3', '16:9', 'default']} defaultValue={'default'} />
            <EnumInput onChange={val => console.log(val)} label="Stretch" value={data.stretch} options={['fill', 'uniform', 'uniform_to_fill', 'none']} defaultValue={'fill'} />

            <Stack
                direction="row"
                justifyContent="space-between"
                gap={2}
            >
                <BooleanInput onChange={val => console.log(val)} label="Windowed" value={data.windowed} defaultValue={true} />
                <BooleanInput onChange={val => console.log(val)} label="Borderless" value={data.borderless} defaultValue={false} />
                <BooleanInput onChange={val => console.log(val)} label="Interactive" value={data.interactive} defaultValue={true} />
                <BooleanInput onChange={val => console.log(val)} label="Always On Top" value={data.alwaysOnTop} defaultValue={false} />
            </Stack>

            <Stack
                direction="row"
                justifyContent="space-between"
                gap={2}
            >
                <NumberInput onChange={val => console.log(val)} label="X" value={data.x} defaultValue={0} />
                <NumberInput onChange={val => console.log(val)} label="Y" value={data.y} defaultValue={0} />
                <NumberInput onChange={val => console.log(val)} label="Width" value={data.width} defaultValue={0} />
                <NumberInput onChange={val => console.log(val)} label="Height" value={data.height} defaultValue={0} />
            </Stack>

            <Stack
                direction="row"
                justifyContent="space-between"
                gap={2}
            >
                <BooleanInput onChange={val => console.log(val)} label="Key Only" value={data.keyOnly} defaultValue={false} />
                <BooleanInput onChange={val => console.log(val)} label="VSync" value={data.vsync} defaultValue={false} />
                <BooleanInput onChange={val => console.log(val)} label="SBS Key" value={data.sbsKey} defaultValue={false} />
            </Stack>

            <EnumInput onChange={val => console.log(val)} label="Colour Space" value={data.colourSpace} options={['RGB', 'datavideo-full', 'datavideo-limited']} defaultValue={'RGB'} />
        </ConsumerConfig>
    );
};