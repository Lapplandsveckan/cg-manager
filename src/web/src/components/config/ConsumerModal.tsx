import React, {useState, useEffect} from 'react';
import {Box, Button, Card, Modal, Stack, Typography} from '@mui/material';
import {useTranslation} from 'next-i18next';
import {CasparConfig} from '../../lib/api/caspar';
import {
    CONSUMER_FIELDS,
    CONSUMER_TYPES,
    ConsumerType,
    Fields,
    RecordData,
    formatConsumerType,
} from './fields';
import {ArtnetEditor} from './ArtnetEditor';

type Consumer = CasparConfig['channels'][number]['consumers'][number];

interface ConsumerModalProps {
    open: boolean;
    /** Existing consumer to edit. Null when adding — `newType` must then be set. */
    consumer: Consumer | null;
    /** Type chosen in the picker, used when `consumer` is null. */
    newType?: ConsumerType;
    canvasWidth: number;
    canvasHeight: number;
    /** 1-based CG channel this consumer lives on; used by the Artnet editor's
     *  optional live-preview backdrop. */
    previewChannel?: number | null;
    onClose: () => void;
    onSave: (consumer: Consumer) => void;
    onDelete?: () => void;
}

const isKnown = (type: string): type is ConsumerType =>
    (CONSUMER_TYPES as readonly string[]).includes(type);

export const ConsumerModal: React.FC<ConsumerModalProps> = ({
    open,
    consumer,
    newType,
    canvasWidth,
    canvasHeight,
    previewChannel,
    onClose,
    onSave,
    onDelete,
}) => {
    const {t} = useTranslation('common');
    // Pinned at open time and never edited from inside the modal — the type
    // picker now decides this up front, so changing it mid-edit (and wiping
    // the user's data with it) isn't a thing anymore.
    const [type, setType] = useState<ConsumerType>('screen');
    const [data, setData] = useState<RecordData>({});

    useEffect(() => {
        if (!open) return;
        if (consumer) {
            const t = isKnown(consumer.type) ? consumer.type : 'screen';
            setType(t);
            setData({...(consumer.data ?? {})});
            return;
        }
        // Adding a fresh consumer of the picker-chosen type.
        setType(newType ?? 'screen');
        setData({});
    }, [open, consumer, newType]);

    const handleSave = () => {
        // Strip undefined/empty-string keys so we don't write empty XML
        // elements back. Nested objects/arrays already self-clean via the
        // ObjectField / ArrayField components.
        const cleaned: RecordData = {};
        for (const [k, v] of Object.entries(data))
            if (v !== undefined && v !== '') cleaned[k] = v;

        onSave({type, data: cleaned as any});
        onClose();
    };

    const fields = CONSUMER_FIELDS[type];
    const typeLabel = t(`config.consumers.types.${type}`, {defaultValue: formatConsumerType(type)});
    const title = consumer
        ? t('config.consumers.editTitle', {type: typeLabel})
        : t('config.consumers.addTitle', {type: typeLabel});

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(1200px, 95vw)',
                    maxHeight: '95vh',
                    overflowY: 'auto',
                }}
            >
                <Card sx={{p: 3}}>
                    <Stack spacing={3}>
                        <Stack spacing={1}>
                            <Stack direction="row" alignItems="baseline" gap={1.5} flexWrap="wrap">
                                <Typography variant="h3">
                                    {title}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontFamily: 'monospace',
                                        textTransform: 'lowercase',
                                    }}
                                >
                                    {type}
                                </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                {t('config.consumers.restartNote')}
                            </Typography>
                        </Stack>

                        {type === 'artnet' ? (
                            <ArtnetEditor
                                data={data}
                                canvasWidth={canvasWidth}
                                canvasHeight={canvasHeight}
                                previewChannel={previewChannel}
                                onChange={(next) => setData(next)}
                            />
                        ) : (
                            <Fields
                                fields={fields}
                                data={data}
                                onChange={(k, v) => setData((d) => ({...d, [k]: v}))}
                            />
                        )}

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                                {onDelete && consumer && (
                                    <Button color="error" onClick={() => { onDelete(); onClose(); }}>
                                        {t('actions.delete')}
                                    </Button>
                                )}
                            </Box>
                            <Stack direction="row" gap={1}>
                                <Button onClick={onClose} color="inherit">{t('actions.cancel')}</Button>
                                <Button onClick={handleSave} variant="contained">{t('actions.save')}</Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            </Box>
        </Modal>
    );
};
