import {Button} from '@mui/material';
import {useSocket} from '@web-lib';
import {ManagerApi} from '../../../../web/src/lib/api/api';

async function toggleMotion(conn: ManagerApi) {
    await conn.rawRequest(`/api/plugin/motion/toggle`, 'ACTION', {});
}

const VideoTest = () => {
    const conn = useSocket();
    return (
        <>
            <Button onClick={() => toggleMotion(conn)}>Toggle Motion</Button>
        </>
    );
};

export default VideoTest;