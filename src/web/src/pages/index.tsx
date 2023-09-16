import {useEffect, useState} from 'react';

const Page = () => {
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/version')
            .then(res => res.json())
            .then(data => setVersion(data.data));
    }, []);

    return (
        <div>
            <h1>Hello World</h1>
            <p>The api is on version {version}</p>
        </div>
    );
};

export default Page;