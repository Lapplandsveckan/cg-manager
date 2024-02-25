import {DefaultContentLayout} from '../components/DefaultContentLayout';
import {useSocket} from '../lib/hooks/useSocket';
import {Stack} from '@mui/material';
import {Injections, UI_INJECTION_ZONE} from '../lib/api/inject';

const Page = () => {
    const conn = useSocket();
    return (
        <DefaultContentLayout>
            <h1>Test</h1>

            <Stack>
                <Injections zone={UI_INJECTION_ZONE.EFFECT_CREATOR} />
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;