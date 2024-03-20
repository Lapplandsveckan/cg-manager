import {DefaultContentLayout} from '../../components/DefaultContentLayout';
import {useSocket} from '../../lib/hooks/useSocket';
import {Stack, Typography} from '@mui/material';
import {useEffect, useState} from 'react';
import Link from 'next/link';

const Page = () => {
    const conn = useSocket();
    const [plugins, setPlugins] = useState([] as string[]);
    useEffect(() => {
        if (!conn) return

        conn.plugin
            .getPlugins()
            .then((plugins) =>
                setPlugins(plugins.map(p => p.name))
            );
    }, [conn]);

    return (
        <DefaultContentLayout>
            <Typography variant="h3">Plugins</Typography>
            <Stack spacing={2}>
                {plugins.map((plugin, i) =>
                    <Link key={plugin} href={`/plugins/${plugin}`}>
                        {plugin}
                    </Link>
                )}
            </Stack>
        </DefaultContentLayout>
    );
};

export default Page;