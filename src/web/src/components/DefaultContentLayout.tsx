import {Stack} from '@mui/material';
import React from 'react';
import {Navbar} from './Navbar';
import {ErrorBoundary} from 'next/dist/client/components/error-boundary';

const ErrorComponent = () => {
    return (
        <div>
            <h1>Something went wrong</h1>
            <p>Sorry about that</p>
        </div>
    );
}

export const DefaultContentLayout = (props: { children: React.ReactNode }) => {
    return (
        <Stack direction="row" alignItems="stretch" justifyContent="start" width="100%" height="100%" >
            <Navbar />
            <Stack flexGrow="1" p={4}>
                <ErrorBoundary errorComponent={ErrorComponent}>
                    {props.children}
                </ErrorBoundary>
            </Stack>
        </Stack>
    );
};