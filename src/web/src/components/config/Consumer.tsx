import {Config} from '../../../../manager/caspar/config/types';
import {Button, Stack} from '@mui/material';
import {ScreenConsumerConfig} from './consumers/Screen';
import React from 'react';
import {SystemAudioConsumerConfig} from './consumers/SystemAudio';

type Consumer = Config['channels'][0]['consumers'][0];
interface ConsumerConfigProps {
    consumer: Consumer;
    onSave: (consumer: Consumer) => void;
    onDelete: () => void;
    children?: React.ReactNode;
}


export type ConsumerConfig = React.FC<ConsumerConfigProps>;
export const ConsumerConfig: ConsumerConfig = ({ consumer, onSave, onDelete, children }) => {
    return (
        <Stack
            width="100%"
            height="100%"

            marginTop={4}
            direction={'column'}
            justifyContent={'space-between'}
        >
            <Stack>
                {children}
            </Stack>
            <Stack
                marginTop={4}
                direction="row"
                justifyContent="flex-end"
            >
                <Button
                    color="info"
                    sx={{
                        margin: '10px',
                    }}
                    onClick={() => onSave(consumer)}
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


export const ConsumerConfigMap: Record<string, ConsumerConfig> = {
    screen: ScreenConsumerConfig,
    'system-audio': SystemAudioConsumerConfig,
};