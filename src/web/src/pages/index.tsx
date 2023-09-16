import {useEffect, useState} from 'react';
import {useSocket} from '../lib/hooks/useSocket';

const CasparLog: React.FC = () => {
    const [logs, setLogs] = useState<string>('');
    const conn = useSocket();

    useEffect(() => {
        const listener = (logs: string) => {
            setLogs(logs);
        };

        conn.caspar.on('logs', listener);
        conn.caspar.getLogs().then(listener);

        return () => {
            conn.caspar.off('logs', listener);
        };
    }, []);

    return (
        <div className="logs" style={{
            whiteSpace: 'pre-wrap',
        }}
        >
            {logs}
        </div>
    );
};

const StatusButton: React.FC = () => {
    const [status, setStatus] = useState<boolean>(false);
    const conn = useSocket();

    useEffect(() => {
        const listener = (status: {running: boolean}) => {
            console.log('Status changed to', status);
            setStatus(status.running);
        };

        conn.caspar.on('status', listener);
        conn.caspar.getStatus().then(listener);

        return () => {
            conn.caspar.off('status', listener);
        };
    }, []);

    return (
        <button
            className="status-button"
            onClick={async () => {
                console.log('Status button clicked');

                if (status) await conn.caspar.stop();
                else await conn.caspar.start();
            }}
            style={{
                backgroundColor: status ? 'green' : 'red',
                color: status ? '#121212' : '#d9d9d9',
            }}
        >
            Server is {status ? 'on' : 'off'} |  Turn {status ? 'off' : 'on'}
        </button>
    );
};

const Page = () => {
    const [version, setVersion] = useState<string | null>(null);
    const conn = useSocket();

    useEffect(() => {
        conn.getApiVersion()
            .then(data => setVersion(data.data));
    }, []);

    return (
        <div className={'app'}>
            <h1>Hello World</h1>
            <p>The api is on version {version}</p>

            <StatusButton />
            <CasparLog/>
        </div>
    );
};

export default Page;