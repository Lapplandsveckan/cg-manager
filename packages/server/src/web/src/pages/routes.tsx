// MIGRATION-SHIM: keeps bookmarks of the pre-plugin /routes page working.
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const RoutesRedirect = () => {
    const router = useRouter();
    useEffect(() => void router.replace('/ext/routes'), [router]);
    return null;
};

export default RoutesRedirect;
