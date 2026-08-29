import { useVersionQuery } from '../query/version';

export function useVersion() {
    const { data } = useVersionQuery();
    return data ?? 'v-.-.-';
}
