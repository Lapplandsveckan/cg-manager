import React from 'react';
import {
    Button,
    Card,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useTranslation } from 'react-i18next';
import { type CasparConfig } from '../../../lib/api/caspar';
import { isSimpleConsumer } from '../../../lib/config/simplePresets';
import { describeConsumer } from '../../../lib/config/describeConsumer';
import { formatConsumerType } from '../fields';

type Consumer = CasparConfig['channels'][number]['consumers'][number];

interface SimpleOutputRowProps {
    consumer: Consumer;
    onEdit: () => void;
    onDelete: () => void;
    onGoAdvanced: () => void;
}

export const SimpleOutputRow: React.FC<SimpleOutputRowProps> = ({
    consumer,
    onEdit,
    onDelete,
    onGoAdvanced,
}) => {
    const { t } = useTranslation('common');
    const locked = !isSimpleConsumer(consumer.type);
    const typeLabel = t(`config.consumers.types.${consumer.type}`, {
        defaultValue: formatConsumerType(consumer.type),
    });
    const summary = describeConsumer(consumer, t);

    return (
        <Card
            variant="outlined"
            sx={theme => ({
                p: 1.5,
                bgcolor: theme.palette.surface.elevated,
                opacity: locked ? 0.7 : 1,
            })}
        >
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={2}
            >
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={0.75}>
                        {locked && (
                            <LockOutlinedIcon
                                fontSize="inherit"
                                sx={{ color: 'text.secondary' }}
                            />
                        )}
                        <Typography variant="body1">{typeLabel}</Typography>
                    </Stack>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                    >
                        {locked
                            ? t('config.simple.outputs.advancedOnly')
                            : summary}
                    </Typography>
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5}>
                    {locked ? (
                        <Button size="small" onClick={onGoAdvanced}>
                            {t('config.simple.outputs.openAdvanced')}
                        </Button>
                    ) : (
                        <Tooltip title={t('actions.edit')}>
                            <IconButton size="small" onClick={onEdit}>
                                <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title={t('actions.delete')}>
                        <IconButton size="small" onClick={onDelete}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Card>
    );
};
