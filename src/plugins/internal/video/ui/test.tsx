import {Button} from '@mui/material';
import {useSocket} from '@web-lib';
import {ManagerApi} from '../../../../web/src/lib/api/api';

async function playVideo(conn: ManagerApi, media: string, destination: string, transform?: number[]) {
    const { status, data } = await conn.rawRequest('/api/plugin/video/effects/video', 'ACTION', {
        group: destination,
        clip: media,
        disposeOnStop: true,
        transform,
    });

    if (status !== 200) {
        console.error('Error playing video', data);
        return;
    }

    await conn.rawRequest(`/api/plugin/video/effects/video/${data.id}/play`, 'ACTION', {});
}

function basicTest(conn: ManagerApi) {
    const media = 'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/RED_VELVET_SNOW_HD';
    const destination = '1:video';

    playVideo(conn, media, destination);
}

function ultimateTest(conn: ManagerApi) {
    const medias = [
        'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/RED_VELVET_SNOW_HD',
        'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/RED_VELVET_SNOW_HD',
        'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/RED_VELVET_SNOW_HD',
        'MOTIONS/WINTER_ARBORIST_MOTIONS_HD/RED_VELVET_SNOW_HD',
    ];

    const destination = '1:video';

    for (let i = 0; i < medias.length; i++) {
        const x = i % 2;
        const y = Math.floor(i / 2);

        const dx = x * 0.5;
        const dy = y * 0.5;

        const media = medias[i];
        const transform = [
            // 0, 0, 1, 1,
            // 0, 0, 1, 1,

            0, 0, 1, 1,
            dx, dy, dx + 0.5, dy + 0.5,
        ];

        playVideo(conn, media, destination, transform);
    }
}

const VideoTest = () => {
    const conn = useSocket();
    return (
        <>
            <Button onClick={() => basicTest(conn)}>Basic Test</Button>
            <Button onClick={() => ultimateTest(conn)}>Ultimate Test</Button>
        </>
    );
};

export default VideoTest;