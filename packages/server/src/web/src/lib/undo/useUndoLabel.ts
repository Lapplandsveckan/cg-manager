import { useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import type { UndoLabel } from './types';

export function useUndoLabel(): (label: UndoLabel) => string {
    const { t } = useTranslation('common');

    return useCallback(
        (label: UndoLabel) => {
            if (label.text !== undefined) return label.text;
            if (typeof label.key !== 'string' || !label.key)
                return t('undo.labels.unknown');
            if (label.key.includes(':')) return t(label.key, label.params);
            return t(`undo.labels.${label.key}`, label.params);
        },
        [t],
    );
}
