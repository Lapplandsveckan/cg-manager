import {Button} from '@mui/material';
import {useSocket} from '@web-lib';
import {ManagerApi} from '../../../../web/src/lib/api/api';
import React from 'react';

async function toggleSwish(conn: ManagerApi) {
    await conn.rawRequest('/api/plugin/overlay/swish', 'ACTION', {});
}

const SwishTest = () => {
    const conn = useSocket();

    return (
        <>
            <Button
                onClick={() => toggleSwish(conn)}
            >
                Template
            </Button>
        </>
    );
};

export default SwishTest;