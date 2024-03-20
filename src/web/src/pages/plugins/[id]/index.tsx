import {DefaultContentLayout} from '../../../components/DefaultContentLayout';
import {useSocket} from '../../../lib';
import {Injections, UI_INJECTION_ZONE} from '../../../lib/api/inject';
import {useRouter} from 'next/router';
import {useEffect} from 'react';

const Page = () => {
    const router = useRouter();
    const {id} = router.query;

    const conn = useSocket();
    useEffect(() => {
        let mounted = true;
        conn.injects.getInjects(UI_INJECTION_ZONE.PLUGIN_PAGE, id as string)
            .then(injects => mounted && injects.length === 0 && router.push('/404'));

        return () => void (mounted = false);
    }, [conn, id]);

    return (
        <DefaultContentLayout>
            <Injections zone={UI_INJECTION_ZONE.PLUGIN_PAGE} plugin={id as string}/>
        </DefaultContentLayout>
    );
};

export default Page;