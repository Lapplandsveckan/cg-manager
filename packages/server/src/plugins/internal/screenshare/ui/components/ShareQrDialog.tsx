import React, { useEffect, useState } from 'react';
import {
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';

interface ShareQrDialogProps {
    /** Absolute guest URL, or null while nothing is being shown. */
    url: string | null;
    label: string;
    onClose: () => void;
}

export const ShareQrDialog: React.FC<ShareQrDialogProps> = ({
    url,
    label,
    onClose,
}) => {
    const { t } = useTranslation('screenshare');
    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
        setImage(null);
        if (!url) return;

        let current = true;
        QRCode.toDataURL(url, { width: 320, margin: 1 })
            .then(data => current && setImage(data))
            .catch(() => current && setImage(null));

        return () => {
            current = false;
        };
    }, [url]);

    return (
        <Dialog open={!!url} onClose={onClose} maxWidth="xs">
            <DialogTitle>{label}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} alignItems="center" sx={{ pb: 1 }}>
                    {image && (
                        <Box
                            component="img"
                            src={image}
                            alt=""
                            sx={{ width: 280, height: 280 }}
                        />
                    )}
                    {!image && (
                        <Typography variant="body2" color="text.secondary">
                            {t('shares.qrFailed')}
                        </Typography>
                    )}
                    <Typography
                        variant="caption"
                        sx={{
                            color: 'text.secondary',
                            wordBreak: 'break-all',
                            textAlign: 'center',
                        }}
                    >
                        {url}
                    </Typography>
                </Stack>
            </DialogContent>
        </Dialog>
    );
};
