import {Button, Stack, Typography} from '@mui/material';
import {ListItem, NumberInput, Section, StringInput} from './Input';
import {Config} from '../../../../manager/caspar/config/types';
import {ConsumerConfigMap} from './Consumer';

interface ChannelEditorProps {
    index: number;
    channel: Config['channels'][0];
    onSelectConsumer: (consumer: number) => void;
    onSave: (channel: Config['channels'][0]) => void;
    onDelete: () => void;
}

interface VideoModeEditorProps {
    videomode: Config['videoModes'][0];
    onSave: (videomode: Config['videoModes'][0]) => void;
    onDelete: () => void;
}

const formatConsumerName = consumer => `${consumer.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Consumer`;
export const ChannelEditor: React.FC<ChannelEditorProps> = ({ index, channel, onSelectConsumer, onSave, onDelete }) => {
    return (
        <Stack
            width="100%"
            height="100%"

            padding={4}
            direction={'column'}
            justifyContent={'space-between'}
        >
            <Stack>
                <Typography
                    variant="h2"
                    fontSize={20}
                    fontWeight={500}
                    marginBottom={2}
                >
                    Channel {index + 1}
                </Typography>
                <StringInput
                    label="Video Mode"
                    value={channel.videoMode}
                    required
                    onChange={val => console.log(val)}
                />
                <Section
                    title={'Consumers'}
                >
                    {channel.consumers.map((consumer, i) => (
                        <ListItem
                            key={`${i}${consumer.type}`}
                            item={formatConsumerName(consumer.type)}
                            onEdit={() => onSelectConsumer(i)}
                        />
                    ))}
                    <Button
                        fullWidth={false}
                        sx={{
                            marginTop: '20px',
                        }}
                    >
                        Add Consumer
                    </Button>
                </Section>
            </Stack>
            <Stack
                direction="row"
                justifyContent="flex-end"
            >
                <Button
                    color="info"
                    sx={{
                        margin: '10px',
                    }}
                    onClick={() => onSave(channel)}
                >
                    Save
                </Button>
                <Button
                    color="error"
                    sx={{
                        margin: '10px',
                    }}
                    onClick={() => onDelete()}
                >
                    Delete
                </Button>
            </Stack>
        </Stack>
    );
};

export const VideoModeEditor: React.FC<VideoModeEditorProps> = ({ videomode, onSave, onDelete }) => {
    return (
        <Stack
            width="100%"
            height="100%"

            padding={4}
            direction={'column'}
            justifyContent={'space-between'}
        >
            <Stack>
                <Typography
                    variant="h2"
                    fontSize={20}
                    fontWeight={500}
                    marginBottom={2}
                >
                    Video Mode
                </Typography>
                <StringInput
                    label="Name"
                    value={videomode.id}
                    onChange={val => console.log(val)}
                    required
                />
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    width={850}
                    gap={4}
                    sx={{
                        marginTop: '40px',
                    }}
                >
                    <NumberInput
                        label="Width"
                        value={videomode.width}
                        required
                        onChange={val => console.log(val)}
                    />
                    <NumberInput
                        label="Height"
                        value={videomode.height}
                        required
                        onChange={val => console.log(val)}
                    />
                </Stack>

                <Stack
                    direction="row"
                    justifyContent="space-between"
                    width={850}
                    gap={4}
                    sx={{
                        marginTop: '20px',
                    }}
                >
                    <NumberInput
                        label="Time Scale"
                        value={videomode.timeScale}
                        required
                        onChange={val => console.log(val)}
                    />
                    <NumberInput
                        label="Duration"
                        value={videomode.duration}
                        required
                        onChange={val => console.log(val)}
                    />
                    <NumberInput
                        label="Cadence"
                        value={videomode.cadence}
                        required
                        onChange={val => console.log(val)}
                    />
                </Stack>
            </Stack>
            <Stack
                direction="row"
                justifyContent="flex-end"
            >
                <Button
                    color="info"
                    sx={{
                        margin: '10px',
                    }}
                    onClick={() => onSave(videomode)}
                >
                    Save
                </Button>
                <Button
                    color="error"
                    sx={{
                        margin: '10px',
                    }}
                    onClick={() => onDelete()}
                >
                    Delete
                </Button>
            </Stack>
        </Stack>
    );
};

export const ConsumerEditor = ({ consumer }) => {
    const Editor = ConsumerConfigMap[consumer.type];

    return (
        <Stack
            width="100%"
            padding={4}
            direction={'column'}
            borderRadius={4}
            sx={{
                backgroundColor: '#282828',
            }}
        >
            <Typography>
                {formatConsumerName(consumer.type)}
            </Typography>
            {
                Editor &&
                <Editor
                    consumer={consumer}
                    onSave={() => console.log('save')}
                    onDelete={() => console.log('delete')}
                />
            }
        </Stack>
    );
};