import React, { createContext, useCallback, useContext, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'info' | 'warning' | 'error' | 'success';

interface ToastMessage {
    text: string;
    severity: Severity;
    key: number;
}

type NotifyFn = (text: string, severity?: Severity) => void;

const ToastContext = createContext<NotifyFn>(() => undefined);

export const useToast = (): NotifyFn => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const [open, setOpen] = useState(false);

    const notify = useCallback<NotifyFn>((text, severity = 'info') => {
        setToast({ text, severity, key: Date.now() });
        setOpen(true);
    }, []);

    return (
        <ToastContext.Provider value={notify}>
            {children}
            <Snackbar
                key={toast?.key}
                open={open}
                autoHideDuration={3000}
                onClose={() => setOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={toast?.severity ?? 'info'}
                    onClose={() => setOpen(false)}
                    sx={{ width: '100%' }}
                >
                    {toast?.text}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
};
