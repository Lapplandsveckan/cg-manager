import { RTCDtlsTransport, type DtlsKeys } from 'werift';

let generated: Promise<DtlsKeys> | null = null;

/** Generated once per process; per-session generation dominated session setup time. */
export function dtlsKeys(): Promise<DtlsKeys> {
    if (generated) return generated;

    generated = RTCDtlsTransport.SetupCertificate().then(cert => ({
        certPem: cert.certPem,
        keyPem: cert.privateKey,
        signatureHash: cert.signatureHash,
    }));
    generated.catch(() => {
        /* callers fall back to werift's per-session cert */
    });

    return generated;
}
