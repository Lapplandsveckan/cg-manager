import { useState } from 'react';
import { type CasparConfig } from '../api/caspar';
import { type ConsumerType } from '../../components/config/fields';

type Channel = CasparConfig['channels'][number];
type Consumer = Channel['consumers'][number];

interface EditingConsumer {
    channelIndex: number;
    consumerIndex: number | null; // null = creating
    newType?: ConsumerType; // set when creating — chosen in the type picker
}

export function useConsumerEditor(
    draft: CasparConfig | null,
    updateChannel: (i: number, channel: Channel) => void,
) {
    const [editingConsumer, setEditingConsumer] =
        useState<EditingConsumer | null>(null);
    // Channel index whose "Add consumer" was clicked — shows the type picker.
    // Once the user chooses, transitions into editingConsumer with the picked
    // type baked in.
    const [pickingForChannel, setPickingForChannel] = useState<number | null>(
        null,
    );

    const deleteConsumerAt = (channelIndex: number, consumerIndex: number) => {
        if (!draft) return;
        const ch = draft.channels[channelIndex];
        if (!ch) return;
        updateChannel(channelIndex, {
            ...ch,
            consumers: ch.consumers.filter((_, idx) => idx !== consumerIndex),
        });
    };

    const editingExistingConsumer: Consumer | null = (() => {
        if (!editingConsumer || !draft) return null;
        const { channelIndex, consumerIndex } = editingConsumer;
        if (consumerIndex === null) return null;
        return draft.channels[channelIndex]?.consumers[consumerIndex] ?? null;
    })();

    // Visual editors (artnet canvas, etc.) need the channel's output
    // resolution. Look it up via the channel's videoMode → videoModes entry,
    // falling back to 1080p when not found.
    const canvasSize: { width: number; height: number } = (() => {
        const fallback = { width: 1920, height: 1080 };
        if (!editingConsumer || !draft) return fallback;
        const channel = draft.channels[editingConsumer.channelIndex];
        if (!channel) return fallback;
        const mode = draft.videoModes.find(m => m.id === channel.videoMode);
        if (!mode) return fallback;
        return { width: mode.width, height: mode.height };
    })();

    const startPicking = (channelIndex: number) =>
        setPickingForChannel(channelIndex);

    const cancelPicking = () => setPickingForChannel(null);

    const pickType = (type: ConsumerType) => {
        if (pickingForChannel === null) return;
        setEditingConsumer({
            channelIndex: pickingForChannel,
            consumerIndex: null,
            newType: type,
        });
        setPickingForChannel(null);
    };

    const editConsumer = (channelIndex: number, consumerIndex: number) =>
        setEditingConsumer({ channelIndex, consumerIndex });

    const closeEditor = () => setEditingConsumer(null);

    const saveConsumer = (consumer: Consumer) => {
        if (!editingConsumer || !draft) return;
        const { channelIndex, consumerIndex } = editingConsumer;
        const ch = draft.channels[channelIndex];
        if (!ch) return;
        const consumers =
            consumerIndex === null
                ? [...ch.consumers, consumer]
                : ch.consumers.map((c, idx) =>
                      idx === consumerIndex ? consumer : c,
                  );
        updateChannel(channelIndex, { ...ch, consumers });
    };

    const deleteConsumer = () => {
        if (!editingConsumer) return;
        const { channelIndex, consumerIndex } = editingConsumer;
        if (consumerIndex === null) return;
        deleteConsumerAt(channelIndex, consumerIndex);
    };

    return {
        editingConsumer,
        editingExistingConsumer,
        canvasSize,
        pickingForChannel,
        startPicking,
        cancelPicking,
        pickType,
        editConsumer,
        closeEditor,
        saveConsumer,
        deleteConsumer,
        deleteConsumerAt,
    };
}
