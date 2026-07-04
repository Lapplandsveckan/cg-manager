export const isMockMode = (): boolean =>
    process.env.CASPAR_MOCK === '1' || process.env.CASPAR_MOCK === 'true';
