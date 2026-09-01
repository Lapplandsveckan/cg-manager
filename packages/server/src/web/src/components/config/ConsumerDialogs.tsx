import React from 'react';
import { useCapabilities } from '../../lib/hooks/useCapabilities';
import { type useConsumerEditor } from '../../lib/config/useConsumerEditor';
import {
    SIMPLE_CONSUMER_DEFAULTS,
    SIMPLE_CONSUMER_TYPES,
} from '../../lib/config/simplePresets';
import { ConsumerModal } from './ConsumerModal';
import { ConsumerTypePicker } from './ConsumerTypePicker';

type ConsumerEditor = ReturnType<typeof useConsumerEditor>;

interface ConsumerDialogsProps extends ConsumerEditor {
    simple?: boolean;
}

export const ConsumerDialogs: React.FC<ConsumerDialogsProps> = ({
    editingConsumer,
    editingExistingConsumer,
    canvasSize,
    pickingForChannel,
    cancelPicking,
    pickType,
    closeEditor,
    saveConsumer,
    deleteConsumer,
    simple,
}) => {
    const { capabilities } = useCapabilities();
    const newType = editingConsumer?.newType;

    return (
        <>
            <ConsumerTypePicker
                open={pickingForChannel !== null}
                types={simple ? SIMPLE_CONSUMER_TYPES : undefined}
                titleKey={
                    simple ? 'config.simple.outputs.pickerTitle' : undefined
                }
                descriptionKey={
                    simple
                        ? 'config.simple.outputs.pickerDescription'
                        : undefined
                }
                onClose={cancelPicking}
                onSelect={pickType}
            />

            <ConsumerModal
                open={editingConsumer !== null}
                consumer={editingExistingConsumer}
                newType={newType}
                capabilities={capabilities}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                previewChannel={
                    editingConsumer !== null
                        ? editingConsumer.channelIndex + 1
                        : null
                }
                simple={simple}
                defaults={
                    simple && newType
                        ? SIMPLE_CONSUMER_DEFAULTS[newType]
                        : undefined
                }
                onClose={closeEditor}
                onSave={saveConsumer}
                onDelete={editingExistingConsumer ? deleteConsumer : undefined}
            />
        </>
    );
};
