import React, {useState} from 'react';
import {Checkbox, FormControlLabel, Tooltip} from '@mui/material';
import {useSocket} from '@web-lib';

/**
 * UPLOAD_OPTIONS injection: renders a "Skip encoding" checkbox inside
 * the core Upload modal. When toggled, it calls
 * `POST /api/plugin/encode/exempt` for every file the user is about
 * to upload (or has just started uploading), writing a
 * `<path>.cgnoencode` sidecar.
 *
 * The host (Upload modal) passes the resolved target paths via
 * `props.targetPaths`. Paths are absolute paths inside the manager's
 * media root — we don't try to validate them here, the server route
 * does that.
 */
interface Props {
    targetPaths?: string[];
}

const UploadOption: React.FC<Props> = ({targetPaths}) => {
    const socket = useSocket();
    const [skip, setSkip] = useState(false);
    const [busy, setBusy] = useState(false);

    const paths = targetPaths ?? [];

    const handleToggle = async (_: unknown, checked: boolean) => {
        if (!socket || !paths.length) {
            setSkip(checked);
            return;
        }
        setBusy(true);
        setSkip(checked);
        // Fire all in parallel — sidecars are independent files. If
        // the request fails the checkbox state still flips visually,
        // but the plugin will encode normally; that's the right
        // failure mode (encoding rather than silently skipping).
        await Promise.all(paths.map((path) =>
            socket.rawRequest('/api/plugin/encode/exempt', 'ACTION', { path, exempt: checked }),
        ));
        setBusy(false);
    };

    if (!paths.length) return null;

    return (
        <Tooltip title="Skip the encoding step for these files — useful for transparent videos or pre-encoded masters.">
            {/* span wrapper so the Tooltip ref works even when the
                FormControlLabel is disabled / inside busy state */}
            <span style={{display: 'inline-flex'}}>
                <FormControlLabel
                    control={
                        <Checkbox
                            size="small"
                            checked={skip}
                            disabled={busy}
                            onChange={handleToggle}
                        />
                    }
                    label="Skip encoding"
                    sx={{ ml: 0 }}
                />
            </span>
        </Tooltip>
    );
};

export default UploadOption;
