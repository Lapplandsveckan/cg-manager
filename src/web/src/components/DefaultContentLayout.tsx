import {Stack} from '@mui/material';
import React from 'react';
import {Navbar} from './Navbar';

class ErrorBoundary extends React.Component<
    { children: React.ReactNode; fallback: React.ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Unhandled error in DefaultContentLayout', error, info);
    }

    render() {
        return this.state.hasError ? this.props.fallback : this.props.children;
    }
}

const ErrorFallback = (
    <div>
        <h1>Something went wrong</h1>
        <p>Sorry about that</p>
    </div>
);

export const DefaultContentLayout = (props: { children: React.ReactNode }) => {
    return (
        <Stack direction="row" alignItems="stretch" justifyContent="start" width="100%" height="100%" >
            <Navbar />
            <Stack flexGrow="1" p={4}>
                <ErrorBoundary fallback={ErrorFallback}>
                    {props.children}
                </ErrorBoundary>
            </Stack>
        </Stack>
    );
};