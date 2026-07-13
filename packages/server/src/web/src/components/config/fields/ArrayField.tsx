import React from 'react';
import {
    Button,
    Card,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useTranslation } from 'next-i18next';
import { Fields } from '../fields';
import type { FieldDef, RecordData } from '../fields';

interface ArrayFieldProps {
    def: Extract<FieldDef, { type: 'array' }>;
    value: RecordData[] | undefined;
    onChange: (value: RecordData[]) => void;
}

export const ArrayField: React.FC<ArrayFieldProps> = ({
    def,
    value,
    onChange,
}) => {
    const { t } = useTranslation('common');
    const tr = (s: string) => t(s, { defaultValue: s });
    const label = tr(def.label);
    const itemLabel = tr(def.itemLabel);
    const items = value ?? [];

    const updateItem = (i: number, key: string, v: any) =>
        onChange(
            items.map((item, idx) =>
                idx === i ? { ...item, [key]: v } : item,
            ),
        );
    const removeItem = (i: number) =>
        onChange(items.filter((_, idx) => idx !== i));
    const addItem = () => onChange([...items, {}]);

    return (
        <Card
            variant="outlined"
            sx={theme => ({ p: 2, bgcolor: theme.palette.surface.elevated })}
        >
            <Stack spacing={2}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                >
                    <Typography variant="h4">{label}</Typography>
                    <Button
                        size="small"
                        startIcon={<AddRoundedIcon />}
                        onClick={addItem}
                    >
                        {t('config.fields.addItem', {
                            item: itemLabel.toLowerCase(),
                        })}
                    </Button>
                </Stack>
                {items.length === 0 && (
                    <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                    >
                        {t('config.fields.emptyItems', {
                            item: itemLabel.toLowerCase(),
                        })}
                    </Typography>
                )}
                {items.map((item, i) => (
                    <Card
                        key={i}
                        sx={theme => ({
                            p: 2,
                            bgcolor: theme.palette.surface.paper,
                        })}
                    >
                        <Stack spacing={1.5}>
                            <Stack
                                direction="row"
                                justifyContent="space-between"
                                alignItems="center"
                            >
                                <Typography variant="body1">
                                    {itemLabel} {i + 1}
                                </Typography>
                                <Tooltip title={t('actions.delete')}>
                                    <IconButton
                                        size="small"
                                        onClick={() => removeItem(i)}
                                    >
                                        <DeleteOutlineRoundedIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                            <Fields
                                fields={def.fields}
                                data={item}
                                onChange={(k, v) => updateItem(i, k, v)}
                            />
                        </Stack>
                    </Card>
                ))}
            </Stack>
        </Card>
    );
};
