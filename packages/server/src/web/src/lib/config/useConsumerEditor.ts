import { useState } from 'react';
import { type CasparConfig } from '../api/caspar';
import { type ConsumerType } from '../../components/config/fields';
import { BUILTIN_MODE_SIZES } from '../videoModes';

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
    // resolution. Look it up via the channel's videoMode → custom
    // videoModes entry first, then the built-in mode table (a channel on a
    // built-in mode has no entry in draft.videoModes), falling back to
    // 1080p only if the mode id is unrecognized.
    const canvasSize: { width: number; height: number } = (() => {
        const fallback = { width: 1920, height: 1080 };
        if (!editingConsumer || !draft) return fallback;
        const channel = draft.channels[editingConsumer.channelIndex];
        if (!channel) return fallback;
        const custom = draft.videoModes.find(m => m.id === channel.videoMode);
        if (custom) return { width: custom.width, height: custom.height };
        return BUILTIN_MODE_SIZES[channel.videoMode] ?? fallback;
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
