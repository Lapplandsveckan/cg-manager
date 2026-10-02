// MIGRATION-SHIM: see CLAUDE.md "Temporary migration shims"
import { useEffect } from 'react';
import { useRouter } from 'next/router';

const RoutesRedirect = () => {
    const router = useRouter();
    useEffect(() => void router.replace('/ext/routes'), [router]);
    return null;
};

export default RoutesRedirect;
