import {ConsumerConfig} from '../Consumer';
import {schemas} from '../../../../../manager/caspar/config/schemas';
import {EnumInput, NumberInput} from '../Input';


export const SystemAudioConsumerConfig: ConsumerConfig = ({ consumer, onSave, onDelete }) => {
    const data = consumer.data as typeof schemas['system-audio'];
    return (
        <ConsumerConfig
            consumer={consumer}
            onSave={() => onSave(consumer)} // TODO: Implement onSave
            onDelete={onDelete}
        >
            <EnumInput onChange={val => console.log(val)} label="Channel Layout" value={data.channelLayout} options={['mono', 'stereo', 'matrix']} defaultValue={'stereo'} />
            <NumberInput onChange={val => console.log(val)} label="Latency" value={data.latency} defaultValue={200} />
        </ConsumerConfig>
    );
};