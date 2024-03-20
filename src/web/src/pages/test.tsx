import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {useSocket} from '../lib/hooks/useSocket';
import {Stack} from '@mui/material';

const Page = () => {
    const conn = useSocket();
    return (
        <DefaultContentLayout>
            <h1>Test</h1>

            <Stack>

            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;