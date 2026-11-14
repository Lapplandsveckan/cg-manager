import React from 'react';
import {
    Card,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded';
import { useTranslation } from 'react-i18next';
import { type ShareLink } from '../../../../../web/src/lib/api/ingest';

interface ShareCardProps {
    share: ShareLink;
    /** Sessions currently attributed to this link, against its own cap. */
    used: number;
    onCopy: () => void;
    onQr: () => void;
    onRevoke: () => void;
}

export const ShareCard: React.FC<ShareCardProps> = ({
    share,
    used,
    onCopy,
    onQr,
    onRevoke,
}) => {
    const { t } = useTranslation('screenshare');
    const full = used >= share.maxSessions;

    return (
        <Card variant="outlined" sx={{ p: 1.5 }}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
            >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                        <Typography variant="h4" noWrap>
                            {share.label}
                        </Typography>
                        <Chip
                            size="small"
                            color={full ? 'warning' : 'default'}
                            variant={full ? 'filled' : 'outlined'}
                            label={t('shares.usage', {
                                used,
                                max: share.maxSessions,
                            })}
                        />
                    </Stack>
                    <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary' }}
                        noWrap
                    >
                        {share.path}
                    </Typography>
                </Stack>

                <Stack direction="row" gap={0.5}>
                    <Tooltip title={t('shares.showQr')}>
                        <IconButton size="small" onClick={onQr}>
                            <QrCode2RoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('shares.copy')}>
                        <IconButton size="small" onClick={onCopy}>
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('shares.revoke')}>
                        <IconButton size="small" onClick={onRevoke}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Card>
    );
};
