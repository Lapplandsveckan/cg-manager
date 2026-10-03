import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Brand } from '../../../schemas/brand';

declare global {
    interface Window {
        __CG_BRAND__?: Brand;
    }
}

const defaultBrand: Brand = {
    name: null,
    tagline: null,
    accent: null,
    home: null,
};

const subscribe = () => () => {};
const clientBrand = () => window.__CG_BRAND__ ?? defaultBrand;
const serverBrand = () => defaultBrand;

export const useBrand = () =>
    useSyncExternalStore(subscribe, clientBrand, serverBrand);

const localized = (text: Brand['tagline'], language: string) => {
    if (!text) return null;
    if (typeof text === 'string') return text;
    return text[language] ?? text.en ?? null;
};

export function useBrandLabels() {
    const { t, i18n } = useTranslation('common');
    const brand = useBrand();

    return {
        name: brand.name ?? t('brand.name'),
        tagline: localized(brand.tagline, i18n.language) ?? t('brand.tagline'),
    };
}
