import React, {useState, useEffect} from 'react';
import {
    Box,
    Button,
    Card,
    FormControl,
    InputLabel,
    MenuItem,
    Modal,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import {CasparConfig} from '../../lib/api/caspar';
import {
    CONSUMER_FIELDS,
    CONSUMER_TYPES,
    ConsumerType,
    Fields,
    RecordData,
    formatConsumerType,
} from './fields';

type Consumer = CasparConfig['channels'][number]['consumers'][number];

interface ConsumerModalProps {
    open: boolean;
    consumer: Consumer | null;
    onClose: () => void;
    onSave: (consumer: Consumer) => void;
    onDelete?: () => void;
}

const isKnown = (type: string): type is ConsumerType =>
    (CONSUMER_TYPES as readonly string[]).includes(type);

export const ConsumerModal: React.FC<ConsumerModalProps> = ({open, consumer, onClose, onSave, onDelete}) => {
    const [type, setType] = useState<ConsumerType>('screen');
    const [data, setData] = useState<RecordData>({});

    // Reset form state whenever the modal opens. When `consumer` is null we
    // treat it as "Add" and clear, otherwise we populate from the existing
    // consumer. Stale state from a previous edit would leak otherwise.
    useEffect(() => {
        if (!open) return;
        if (!consumer) {
            setType('screen');
            setData({});
            return;
        }
        const t = isKnown(consumer.type) ? consumer.type : 'screen';
        setType(t);
        setData({...(consumer.data ?? {})});
    }, [open, consumer]);

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

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(960px, 95vw)',
                    maxHeight: '95vh',
                    overflowY: 'auto',
                }}
            >
                <Card sx={{p: 3}}>
                    <Stack spacing={3}>
                        <Stack spacing={1}>
                            <Typography variant="h3">
                                {consumer ? 'Edit consumer' : 'Add consumer'}
                            </Typography>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                Restart CasparCG after saving for these changes to take effect.
                            </Typography>
                        </Stack>

                        <FormControl size="small" fullWidth>
                            <InputLabel>Type</InputLabel>
                            <Select
                                label="Type"
                                value={type}
                                onChange={(e) => {
                                    setType(e.target.value as ConsumerType);
                                    setData({});
                                }}
                            >
                                {CONSUMER_TYPES.map((t) => (
                                    <MenuItem key={t} value={t}>
                                        {formatConsumerType(t)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Fields
                            fields={fields}
                            data={data}
                            onChange={(k, v) => setData((d) => ({...d, [k]: v}))}
                        />

                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                                {onDelete && consumer && (
                                    <Button color="error" onClick={() => { onDelete(); onClose(); }}>
                                        Delete
                                    </Button>
                                )}
                            </Box>
                            <Stack direction="row" gap={1}>
                                <Button onClick={onClose} color="inherit">Cancel</Button>
                                <Button onClick={handleSave} variant="contained">Save</Button>
                            </Stack>
                        </Stack>
                    </Stack>
                </Card>
            </Box>
        </Modal>
    );
};
