import React from 'react';
import {Card, Grid, Stack, Typography} from '@mui/material';

export interface MediaCardProps {
    name: string;
    duration: string;

    backgroundUrl: string;
}

export const MediaCard: React.FC<MediaCardProps> = ({name, duration, backgroundUrl}) => {
    return (
        <Grid item xs={12 / 5}>
            <Card
                sx={{
                    aspectRatio: '16/9',
                    backgroundImage: `url(${backgroundUrl})`,
                    backgroundSize: 'cover',
                }}
            >
                <Stack height="100%" direction="column" alignItems="stretch" justifyContent="end">
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"

                        sx={{
                            backgroundColor: '#0009',
                            padding: '5px',
                        }}
                    >
                        <Typography fontSize="8px" color="#ccc">{name}</Typography>
                        <Typography fontSize="12px" color="#aaa">{duration}</Typography>
                    </Stack>
                </Stack>
            </Card>
        </Grid>
    );
}

export function getDurationString(duration: number) {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);
    const ms = Math.floor((duration % 1) * 1000);

    let H = hours.toString();
    let M = minutes.toString();
    let S = seconds.toString();
    let MS = ms.toString();

    if (hours < 10) H = `0${H}`;
    if (minutes < 10) M = `0${M}`;
    if (seconds < 10) S = `0${S}`;
    if (ms < 10) MS = `00${MS}`;

    let durationString = `${M}:${S}.${MS}`;
    if (hours > 0) durationString = `${H}:${durationString}`;
    return durationString;
}