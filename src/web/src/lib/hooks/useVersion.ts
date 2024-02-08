import {useEffect, useState} from 'react';
import {useSocket} from './useSocket';

export function useVersion() {
    const [version, setVersion] = useState('v-.-.-');
    const conn = useSocket();

    useEffect(() => {
        conn.getApiVersion()
            .then(data => setVersion(data.data));
    }, []);

    return version;
}