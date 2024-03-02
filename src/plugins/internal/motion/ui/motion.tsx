import {Button, MenuItem, Select} from '@mui/material';
import {useSocket} from '@web-lib';
import {ManagerApi} from '../../../../web/src/lib/api/api';
import React, {useEffect, useState} from 'react';

async function updateMotion(conn: ManagerApi, clip: string) {
    await conn.rawRequest('/api/plugin/motion/motion', 'ACTION', { clip });
}

async function updateColor(conn: ManagerApi, color: string) {
    await conn.rawRequest('/api/plugin/motion/color', 'ACTION', { color });
}

const VideoTest = () => {
    const conn = useSocket();
    const [motion, setMotion] = useState<string>('');
    const [media, setMedia] = useState<string[]>([]);
    const [color, setColor] = useState<string>();

    useEffect(() => {
        if (!conn) return;
        conn.caspar.getMedia().then(media => {
            setMedia([...media.values()].map(m => m.id));
        });
    }, [conn]);

    return (
        <>
            <Select
                variant="outlined"
                label="Clip"
                color="primary"
                value={motion}
                onChange={async (event) => {
                    const clip = event.target.value as string;
                    if (!clip) return;

                    setMotion(clip);
                    await updateMotion(conn, clip);
                }}
            >
                {
                    media.length ?
                        media.map(m => (
                            <MenuItem value={m} key={m}>{m}</MenuItem>
                        )) :
                        <MenuItem value={''}>No media available</MenuItem>
                }
            </Select>
            <input
                type="color"
                onChange={async (event) => {
                    const color = event.target.value as string;

                    setColor(color);
                    await updateColor(conn, color);
                }}
                value={color}
            />
            <Button onClick={async () => {
                setColor(undefined);
                await updateColor(conn, undefined);
            }}>Clear</Button>
        </>
    );
};

export default VideoTest;