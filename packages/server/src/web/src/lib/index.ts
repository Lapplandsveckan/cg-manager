export { useSocket } from './hooks/useSocket';
export { useBroadcast } from './hooks/useBroadcast';
export { topic } from './api/broadcasts';
export { pluginHttpUrl } from './api/pluginHttpUrl';
export type { BroadcastTopic } from './api/broadcasts';
export { Method, WebError } from 'rest-exchange-protocol-client';
export {
    useContextMenu,
    useRegisterContextMenuItems,
} from '../components/ContextMenuProvider';
export type {
    ContextMenuItem,
    ContextMenuSurface,
    ContextMenuItemProvider,
    ContextMenuMediaTarget,
    ContextMenuRundownItemTarget,
    ContextMenuRouteTarget,
    ContextMenuPluginTarget,
} from '../components/ContextMenuProvider';
export { MediaView } from '../components/MediaView';
export { MediaSelect } from '../components/MediaSelectPicker';
export { MediaCard } from '../components/MediaCard';
export {
    RundownEditorActionBar,
    InstantPlayoutContext,
} from '../components/RundownEditor';
export {
    RundownColorPicker,
    RUNDOWN_COLOR_PRESETS,
    normalizeRundownColor,
} from '../components/RundownColorPicker';
export {
    Dropzone,
    UploadButton,
    UploadModal,
    useFileUpload,
} from '../components/Upload';
export type {
    FileUploadController,
    FileUploadState,
    UploadPhase,
    UploadFileResult,
} from '../components/Upload';
export { MediaDropZone } from '../components/MediaDropZone';
export type { MediaDropZoneProps } from '../components/MediaDropZone';
export { useRundownLive, RundownLiveProvider } from '../hooks/useRundownLive';
export { ChannelPreview } from '../components/ChannelPreview';
export { useToast } from '../components/ToastProvider';
export { SlotErrorBoundary } from '../components/SlotErrorBoundary';
export { useStoredBoolean } from './hooks/useStoredBoolean';
export { useMediaDocsQuery } from './query/media';
export { useChannelInfo } from './query/caspar';
export { BUILTIN_VIDEO_MODES } from './videoModes';
// Plugins that cache server data share the host's QueryClient (and, via the
// `ReactQuery` window external, its React context) instead of bundling their own.
export { queryClient } from './query/client';
export {
    defineMutation,
    useMutationSpec,
    runMutation,
} from './query/mutations';
export type { MutationSpec, Rollback } from './query/mutations';
// Plugins commonly need to annotate variables holding a media record (e.g.
// from ManagerApi.caspar.getAllMedia()) without going through the socket API
// module directly.
export type { MediaDoc } from './api/caspar';
// Lets a plugin render a zone that another plugin injects into — the same
// slot machinery the host uses to render plugin UI into its own zones.
export { Injections, Injection, UI_INJECTION_ZONE } from './api/inject';
export type { UI_INJECTION_ZONE_KEY } from './api/inject';
// Plugin-facing undo/redo — see the "Plugin -> undo/redo contract" section
// in CLAUDE.md.
export { createPluginUndo } from './undo/pluginUndo';
export type { PluginUndoAPI } from './undo/pluginUndo';
export type {
    UndoLabel,
    UndoEntry,
    UndoApply,
    UndoContext,
} from './undo/types';
export {
    request,
    requestOk,
    okData,
    omitId,
    rekeyId,
    UndoStaleError,
} from './undo/tools';
// `rekeyId` only updates the undo stack's bookkeeping — callers must also
// resolve `liveId(id)` at every subsequent use of an id that may have been
// through a temp-id -> server-id rekey (see the routes page's create flow
// for the canonical pattern).
export { liveId } from './undo/undoStore';
