import React, {useState} from 'react';
import {Button, FormControl, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography} from '@mui/material';

export interface InputProps<T> {
    label?: string;
    value?: T;
    defaultValue?: T;
    onChange: (value: T) => void;
    required?: boolean;
}

export interface ListItemProps {
    item: string;
    onEdit: () => void;
}

export const StringInput: React.FC<InputProps<string>> = ({ label, value, defaultValue, onChange, required }) => {
    const [val, setVal] = useState<string | undefined>(value);
    const updateValue = (val: string | undefined) => {
        setVal(val);
        onChange(val);
    };

    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            width={400}
            margin="8px 0"
        >
            <TextField
                label={label}
                type="text"
                value={val ?? ''}
                InputLabelProps={{
                    shrink: true,
                }}
                placeholder={defaultValue}
                onChange={e => updateValue(e.target.value)}
                sx={{
                    flexGrow: 1,
                }}
                required={required}
                error={required && val === ''}
            />
            <Button
                sx={{
                    marginLeft: '10px',
                }}
                onClick={() => updateValue(undefined)}
                disabled={required || val === undefined}
            >
                Reset
            </Button>
        </Stack>
    );
};

export const NumberInput: React.FC<InputProps<number>> = ({ label, value, defaultValue, onChange, required }) => {
    const [val, setVal] = useState<string>(value?.toString() ?? '');
    const updateValue = (val: string) => {
        val = val.replace(/[^0-9]/g, '');
        setVal(val);

        let num = parseInt(val);
        if (isNaN(num)) num = undefined;

        onChange(num);
    };

    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            width={400}
            margin="8px 0"
        >
            <TextField
                label={label}
                type="number"
                value={val}
                InputLabelProps={{
                    shrink: true,
                }}
                placeholder={defaultValue?.toString()}
                onChange={e => updateValue(e.target.value)}
                sx={{
                    flexGrow: 1,
                }}
                required={required}
                error={required && val === ''}
            />
            <Button
                sx={{
                    marginLeft: '10px',
                }}
                onClick={() => updateValue('')}
                disabled={required || val === ''}
            >
                Reset
            </Button>
        </Stack>
    );
};

export const BooleanInput: React.FC<InputProps<boolean>> = ({ label, value, defaultValue, onChange, required }) => {
    const [val, setVal] = useState<boolean | undefined>(value);
    const updateValue = (val: boolean | undefined) => {
        setVal(val);
        onChange(val);
    };

    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            margin="8px 0"
        >
            <Typography>
                {label}
            </Typography>
            <Switch
                color="primary"
                checked={val ?? defaultValue ?? false}
                onChange={e => updateValue(e.target.checked)}
            />
            <Button
                sx={{
                    marginLeft: '10px',
                }}
                onClick={() => updateValue(undefined)}
                disabled={required || val === undefined}
            >
                Reset
            </Button>
        </Stack>
    );
};

export const EnumInput: React.FC<InputProps<string> & { options: string[] }> = ({ label, value, defaultValue, onChange, required, options }) => {
    const [val, setVal] = useState<string | undefined>(value);
    const updateValue = (val: string | undefined) => {
        setVal(val);
        onChange(val);
    };

    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            margin="8px 0"
        >
            <FormControl
                sx={{
                    flexGrow: 1,
                }}
            >
                <InputLabel id={label}>
                    {label}
                </InputLabel>
                <Select
                    label={label}
                    labelId={label}
                    value={val ?? defaultValue ?? ''}
                    onChange={e => updateValue(e.target.value as string)}
                    sx={{
                        flexGrow: 1,
                    }}
                    required={required}
                    error={required && value === ''}
                >
                    {options.map(option => (
                        <MenuItem
                            key={option}
                            value={option}
                        >
                            {option}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <Button
                sx={{
                    marginLeft: '10px',
                }}
                onClick={() => updateValue(undefined)}
                disabled={required || val === undefined}
            >
                Reset
            </Button>
        </Stack>
    );
};



export const Section = ({ title, children }) => {
    return (
        <Stack
            marginTop="40px"
        >
            <Typography
                fontSize="20px"
                fontWeight={500}
                marginBottom="20px"
                variant="h2"
            >
                {title}
            </Typography>
            {children}
        </Stack>
    );
};

export const ListItem: React.FC<ListItemProps> = ({ item, onEdit }) => {
    return (
        <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            margin="8px 0"
        >
            <Typography>
                {item}
            </Typography>
            <Button
                onClick={onEdit}
            >
                Edit
            </Button>
        </Stack>
    );
};