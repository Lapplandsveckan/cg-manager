import React from 'react';
import { useCapabilities } from '../../lib/hooks/useCapabilities';
import { type useConsumerEditor } from '../../lib/config/useConsumerEditor';
import { ConsumerModal } from './ConsumerModal';
import { ConsumerTypePicker } from './ConsumerTypePicker';

type ConsumerEditor = ReturnType<typeof useConsumerEditor>;

export const ConsumerDialogs: React.FC<ConsumerEditor> = ({
    editingConsumer,
    editingExistingConsumer,
    canvasSize,
    pickingForChannel,
    cancelPicking,
    pickType,
    closeEditor,
    saveConsumer,
    deleteConsumer,
}) => {
    const { capabilities } = useCapabilities();

    return (
        <>
            <ConsumerTypePicker
                open={pickingForChannel !== null}
                onClose={cancelPicking}
                onSelect={pickType}
            />

            <ConsumerModal
                open={editingConsumer !== null}
                consumer={editingExistingConsumer}
                newType={editingConsumer?.newType}
                capabilities={capabilities}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                previewChannel={
                    editingConsumer !== null
                        ? editingConsumer.channelIndex + 1
                        : null
                }
                onClose={closeEditor}
                onSave={saveConsumer}
                onDelete={editingExistingConsumer ? deleteConsumer : undefined}
            />
        </>
    );
};
