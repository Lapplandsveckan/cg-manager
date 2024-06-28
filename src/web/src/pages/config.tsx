import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {Stack, Typography, Button, Card, Modal} from '@mui/material';
import {useState} from 'react';
import {BooleanInput, NumberInput, Section, ListItem} from '../components/config/Input';
import {ChannelEditor, ConsumerEditor, VideoModeEditor} from '../components/config/Editors';


const DATA = {
    version: '0.0.1',
    html: {
        remoteDebuggingPort: 9222,
        enableGpu: false,
    },
    videoModes: [
        {
            id: '1920x1080p6000',
            width: 1920,
            height: 1080,
            timeScale: 6000,
            duration: 1000,
            cadence: 800,
        },
    ],
    channels: [
        {
            videoMode: '1920x1080p6000',
            consumers: [
                {
                    type: 'screen',
                    data: {
                        device: 2,
                        windowed: true,
                        borderless: true,
                        width: 1920,
                        height: 1200,
                        // alwaysOnTop: true,
                    },
                },
                { type: 'system-audio', data: {} },
            ],
        },
        {
            videoMode: '1920x1080p6000',
            consumers: [],
        },
        {
            videoMode: '1920x1080p6000',
            consumers: [],
        },
    ],
};

const Page = () => {
    const [selectedChannel, setSelectedChannel] = useState<number | undefined>(undefined);
    const [selectedVideoMode, setSelectedVideoMode] = useState<number | undefined>(undefined);
    const [selectedConsumer, setSelectedConsumer] = useState<number | undefined>(undefined);

    return (
        <DefaultContentLayout>
            <Typography
                fontSize="32px"
                fontWeight={600}
                variant="h1"
            >
                Config
            </Typography>
            <Typography
                variant="body1"
            >
                v{DATA.version}
            </Typography>
            <Stack
                direction="row"
            >
                <Stack
                    sx={{
                        width: '400px',
                    }}
                >
                    <Section
                        title={'HTML'}
                    >
                        <NumberInput
                            label="Remote Debugging Port"
                            value={DATA.html.remoteDebuggingPort}
                            defaultValue={0}
                            onChange={val => console.log(val)}
                        />
                        <BooleanInput
                            label="Enable GPU"
                            value={DATA.html.enableGpu}
                            defaultValue={false}
                            onChange={val => console.log(val)}
                        />
                    </Section>
                    <Section
                        title={'Video Modes'}
                    >
                        {DATA.videoModes.map((videoMode, i) => (
                            <ListItem
                                key={videoMode.id}
                                item={`${videoMode.width}x${videoMode.height}p${videoMode.timeScale}`}
                                onEdit={() => {
                                    setSelectedVideoMode(i);
                                    setSelectedChannel(undefined);
                                    setSelectedConsumer(undefined);
                                }}
                            />
                        ))}

                        <Button
                            fullWidth={false}
                            sx={{
                                marginTop: '20px',
                            }}
                        >
                            Add Video Mode
                        </Button>
                    </Section>
                    <Section
                        title={'Channels'}
                    >
                        {DATA.channels.map((channel, i) => (
                            <ListItem
                                key={`${i}${channel.videoMode}${channel.consumers.length}`}
                                item={`${i}: ${channel.videoMode} - ${channel.consumers.length} consumers`}
                                onEdit={() => {
                                    setSelectedChannel(i);
                                    setSelectedVideoMode(undefined);
                                    setSelectedConsumer(undefined);
                                }}
                            />
                        ))}

                        <Button
                            fullWidth={false}
                            sx={{
                                marginTop: '20px',
                            }}
                        >
                            Add Channel
                        </Button>
                    </Section>
                </Stack>
                <Stack
                    sx={{
                        width: '100%',
                        height: '100%',

                        paddingLeft: 12,
                        flexGrow: 1,
                    }}
                >
                    <Card
                        sx={{
                            width: '100%',
                            height: '100%',

                            borderRadius: 8,
                            backgroundColor: '#181818',
                        }}
                    >
                        {selectedChannel !== undefined && (
                            <ChannelEditor
                                index={selectedChannel}
                                channel={DATA.channels[selectedChannel]}
                                onSelectConsumer={consumer => setSelectedConsumer(consumer)}
                                onSave={channel => console.log(channel)}
                                onDelete={() => console.log('delete')}
                            />
                        )}
                        {selectedVideoMode !== undefined && (
                            <VideoModeEditor
                                videomode={DATA.videoModes[selectedVideoMode]}
                                onSave={videomode => console.log(videomode)}
                                onDelete={() => console.log('delete')}
                            />
                        )}
                    </Card>
                </Stack>
            </Stack>
            <Modal
                open={selectedConsumer !== undefined}
                onClose={() => setSelectedConsumer(undefined)}
            >
                <Stack
                    position={'absolute'}
                    top={'50%'}
                    left={'50%'}

                    width={'80%'}

                    sx={{
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    {
                        selectedConsumer !== undefined &&
                        <ConsumerEditor
                            consumer={DATA.channels[selectedChannel].consumers[selectedConsumer]}
                        />
                    }
                </Stack>
            </Modal>
        </DefaultContentLayout>
    );
};

export default Page;