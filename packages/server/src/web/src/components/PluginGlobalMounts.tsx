import React from 'react';
import { Injections, UI_INJECTION_ZONE } from '../lib/api/inject';

export const PluginGlobalMounts: React.FC = () => (
    <Injections zone={UI_INJECTION_ZONE.GLOBAL} />
);
