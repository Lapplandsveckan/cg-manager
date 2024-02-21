// import React from 'react';

import {Button} from '@mui/material';

const VideoTest = () => {
    return (
        <Button
            variant="contained"
            color="primary"

            onClick={() => console.log('Hello World')}
        >
            Hello World
        </Button>
    );
};

export default VideoTest;