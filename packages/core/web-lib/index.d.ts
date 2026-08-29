/**
 * Type declarations for `@web-lib` — the web component/hook library that
 * cg-manager exposes to plugin UIs at runtime as the global `WebLib`.
 *
 * This is a HAND-AUTHORED, types-only mirror of cg-manager's public web-lib
 * surface (`src/web/src/lib/index.ts`). There is no runtime code here — the
 * host (cg-manager) provides the implementation via the `@web-lib → WebLib`
 * webpack external. Plugins resolve this file through a tsconfig `paths`
 * alias: `"@web-lib": ["node_modules/@lappis/cg-manager/web-lib"]`.
 *
 * Keep this in sync with `src/web/src/lib/index.ts` by hand — there is no
 * automated drift guard.
 */

import type * as React from 'react';

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface MediaDoc {
    id: string;

    mediaPath?: string;
    mediaSize?: number;
    mediaTime?: number;

    thumbSize?: number;
    thumbTime?: number;

    cinf?: string;
    tinf?: string;

    mediainfo?: {
        name: string;
        path: string;
        size: number;
        time: number;
        field_order: string;

        streams: {
            codec: {
                long_name: string;
                type: string;
                time_base: string;
                tag_string: string;
                is_avc: any;
            };

            // Video
            width: number;
            height: number;
            sample_aspect_ratio: string;
            display_aspect_ratio: string;
            pix_fmt: string;
            bits_per_raw_sample: string;

            // Audio
            sample_fmt: string;
            sample_rate: number;
            channels: number;
            channel_layout: string;
            bits_per_sample: number;

            // Common
            time_base: string;
            start_time: number;
            duration_ts: string;
            duration: string;

            bit_rate: string;
            max_bit_rate: string;
            nb_frames: string;
        }[];

        format: {
            name: string;
            long_name: string;
            size: string;

            start_time: number;
            duration: number;
            bit_rate: number;
            max_bit_rate: number;
        };
    };

    _attachments?: Record<string, { content_type: string; data: unknown }>;
}

// ---------------------------------------------------------------------------
// Socket / ManagerApi / broadcasts
//
// The real `ManagerApi` (cg-manager `src/web/src/lib/api/api.ts`) is large.
// We declare the members plugins actually reach for; the rest stay broad
// (`any`) on purpose. Tighten here as plugin usage grows.
// ---------------------------------------------------------------------------

export enum Method {
    GET = 'GET',
    CREATE = 'CREATE',
    DELETE = 'DELETE',
    UPDATE = 'UPDATE',
    ACTION = 'ACTION',
}

export interface CasparServerApi {
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    getAllMedia(): Promise<MediaDoc[]>;
    deleteMedia(id: string): Promise<void>;
    renameMedia(id: string, newName: string): Promise<void>;
}

export interface ManagerApi {
    caspar: CasparServerApi;
    videoRoutes: any;
    rundowns: any;
    injects: any;
    plugin: any;

    /** True while the websocket transport is actually open; requests fall
     *  back to HTTP when it drops, so a successful request does not imply
     *  broadcasts are alive. */
    readonly wsConnected: boolean;

    rawRequest(path: string, method: string, data: any): Promise<any>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getApiVersion(): Promise<string>;

    /** Internal — use `useBroadcast` instead of calling this directly. */
    subscribe(
        path: string,
        method: Method,
        handler: (data: unknown) => void,
    ): () => void;
}

/** Throws `NoSocketError` if called outside a connected `SocketProvider`. */
export function useSocket(): ManagerApi;

export interface BroadcastTopic<T> {
    path: string;
    method: Method;
    isValid: (data: unknown) => data is T;
}

/** Subscribe to a server broadcast topic while mounted. */
export function useBroadcast<T>(
    topic: BroadcastTopic<T>,
    handler: (data: T) => void,
): void;

// ---------------------------------------------------------------------------
// Rundown
// ---------------------------------------------------------------------------

export interface RundownEditorActionBarProps {
    /** Primary action — saves the edit. Always present. */
    onSave: () => void;
    /** Dismiss the editor without saving or deleting. */
    onCancel?: () => void;
    /** Destructive action — usually wired up to a confirmation step. */
    onDelete?: () => void;
    /**
     * @deprecated Legacy contract kept so existing plugins keep working.
     * Prefer omitting `exists` and passing `onCancel` + optional `onDelete`.
     */
    exists?: boolean;
}

export const RundownEditorActionBar: React.FC<RundownEditorActionBarProps>;

/** True when the editor is rendered for instant playout. */
export const InstantPlayoutContext: React.Context<boolean>;

export const RundownLiveProvider: React.FC<{
    live: boolean;
    children: React.ReactNode;
}>;

/** `true` when the nearest rundown ancestor is live, `false` otherwise. */
export function useRundownLive(): boolean;

// ---------------------------------------------------------------------------
// Media views
// ---------------------------------------------------------------------------

export interface MediaViewProps {
    columns?: number;
    onClipSelect?: (clip: MediaDoc) => void;
    prefix?: string;

    showAsDirectories?: boolean;
    onNavigate?: (path: string) => void;

    onClipPlay?: (clip: MediaDoc) => void;
    onClipDelete?: (clip: MediaDoc) => void;
    onClipRename?: (clip: MediaDoc) => void;
    onFolderDelete?: (folder: string) => void;
    onFolderRename?: (folder: string) => void;
    onClipMoveToFolder?: (clipId: string, folderFullPath: string) => void;
}

export const MediaView: React.FC<MediaViewProps>;

export interface MediaSelectProps {
    clip?: MediaDoc | null;
    onClipSelect: (clip: MediaDoc) => void;
}

export const MediaSelect: React.FC<MediaSelectProps>;

export interface MediaCardProps {
    name: string;
    duration: number;

    backgroundUrl: string;

    columns?: number;
    onClick?: () => void;
    onPlay?: () => void;
    onDelete?: () => void;
    onRename?: () => void;
    /** Full media id (slash-separated); makes the card draggable. */
    dragId?: string;
}

export const MediaCard: React.FC<MediaCardProps>;

export interface MediaDropZoneProps {
    /** Server-side directory prefix uploads land in (trailing slash). */
    destination?: string;
    createUpload?: (file: File) => Promise<string>;
    targetPathFor?: (file: File) => string;
    onComplete?: (results: UploadFileResult[]) => void;
    accept?: string[];
    multiple?: boolean;
    overlayLabel?: string;
    children: React.ReactNode;
}

export const MediaDropZone: React.FC<MediaDropZoneProps>;

// ---------------------------------------------------------------------------
// Channel preview
// ---------------------------------------------------------------------------

export interface ChannelPreviewProps {
    /** 1-based CasparCG channel number. Disabled when undefined/null. */
    channel: number | null | undefined;
    /** How the video fills its parent. `cover` for stage backdrops, `contain`
     *  for preview cards that need to show the whole frame. */
    objectFit?: 'contain' | 'cover';
    /** Called once when the first frame arrives. Useful for hiding spinners. */
    onReady?: () => void;
    /** Called with a message on WHEP/SDP/ICE failures. */
    onError?: (msg: string) => void;
}

export const ChannelPreview: React.FC<ChannelPreviewProps>;

// ---------------------------------------------------------------------------
// Upload primitives
// ---------------------------------------------------------------------------

export type UploadPhase =
    | 'idle'
    | 'review'
    | 'starting'
    | 'uploading'
    | 'done'
    | 'error';

export interface UploadFileResult {
    file: File;
    error?: string;
}

export interface FileUploadState {
    phase: UploadPhase;
    queue: File[];
    completed: UploadFileResult[];
    currentIndex: number;
    currentProgress: number;
    currentFile: File | null;
    error: string | null;
}

export interface FileUploadController {
    state: FileUploadState;
    start: (files: File[]) => void;
    confirm: () => void;
    cancel: () => void;
    reset: () => void;
}

export function useFileUpload(options: {
    createUpload: (file: File) => Promise<string>;
}): FileUploadController;

export interface DropzoneProps {
    onDrop: (files: File[]) => void;
    children: React.ReactNode;
    accept?: string[];
    multiple?: boolean;
    disabled?: boolean;
    overlayLabel?: string;
    fill?: boolean;
}

export const Dropzone: React.FC<DropzoneProps>;

export interface UploadButtonProps {
    types?: { description?: string; accept: Record<string, string[]> }[];
    createUpload?: (file: File) => Promise<string>;
    controller?: FileUploadController;
    multiple?: boolean;
    label?: string;
    targetPathFor?: (file: File) => string;
}

export const UploadButton: React.FC<UploadButtonProps>;

export interface UploadModalProps {
    state: FileUploadState;
    onClose: () => void;
    onCancel?: () => void;
    onConfirm?: () => void;
    targetPathFor?: (file: File) => string;
    /** Injection zone key for plugin-injected options; `null` suppresses them. */
    optionsZone?: string | null;
}

export const UploadModal: React.FC<UploadModalProps>;

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

export interface ContextMenuItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    /** Renders the item in red — use for destructive actions like Delete. */
    danger?: boolean;
    /** Renders a Divider above this item. */
    divider?: boolean;
}

/** The four host surfaces that plugins can contribute context-menu items to. */
export type ContextMenuSurface = 'rundown-item' | 'media' | 'route' | 'plugin';

/**
 * A function that receives the right-clicked target and returns items to
 * append after the host's built-in items. Falsy entries are filtered out,
 * so you may conditionally return items with `cond && { ... }`.
 */
export type ContextMenuItemProvider<T = unknown> = (
    target: T,
) => (ContextMenuItem | false | null | undefined)[];

// Target descriptors — one per surface.

export interface ContextMenuMediaTarget {
    name: string;
    /** Full slash-separated media id, or null for folders / cards without dragId. */
    id: string | null;
    isFolder: boolean;
    duration?: number;
}

export interface ContextMenuRundownItemTarget {
    id: string;
    title: string;
    type?: string;
    data: unknown;
}

export interface ContextMenuRouteTarget {
    id: string;
    name: string;
    enabled: boolean;
}

export interface ContextMenuPluginTarget {
    name: string;
    enabled: boolean;
    builtin: boolean;
    hasUi: boolean;
    minChannels: number;
}

export interface ContextMenuApi {
    /** Open a menu at the cursor position with the given items. */
    openMenu: (
        event: React.MouseEvent,
        items: (ContextMenuItem | false | null | undefined)[],
    ) => void;
    /** Convenience: returns an `onContextMenu` handler bound to the given items. */
    bind: (
        items: (ContextMenuItem | false | null | undefined)[],
    ) => (event: React.MouseEvent) => void;
    /**
     * Register a provider that appends items to a host surface's context menu.
     * Returns an unsubscribe function. Prefer `useRegisterContextMenuItems`
     * over calling this directly.
     */
    registerProvider: <T>(
        surface: ContextMenuSurface,
        provider: ContextMenuItemProvider<T>,
    ) => () => void;
    /**
     * Open a surface menu, appending any registered plugin items after
     * `hostItems` (separated by a divider). Used by host surfaces internally;
     * plugins normally don't call this directly.
     */
    openSurfaceMenu: <T>(
        event: React.MouseEvent,
        surface: ContextMenuSurface,
        target: T,
        hostItems: (ContextMenuItem | false | null | undefined)[],
    ) => void;
}

/** Access the host's context-menu system from a plugin-injected component. */
export function useContextMenu(): ContextMenuApi;

/**
 * Register a context-menu provider for a host surface. Call this once on
 * mount; cleanup is handled automatically when the component unmounts.
 *
 * The provider function does NOT need to be stable (memoized).
 *
 * @example
 * useRegisterContextMenuItems<ContextMenuRundownItemTarget>(
 *   'rundown-item',
 *   target => [
 *     { label: 'Send to ProPresenter', onClick: () => sendTo(target) },
 *   ],
 * );
 */
export function useRegisterContextMenuItems<T>(
    surface: ContextMenuSurface,
    provider: ContextMenuItemProvider<T>,
): void;

// ---------------------------------------------------------------------------
// UI injection zones
//
// Lets a plugin render a zone that another plugin injects into — the same
// slot machinery the host uses to render plugin UI into its own zones. See
// the "Plugin -> bottom-panel tab contract" section in CLAUDE.md.
// ---------------------------------------------------------------------------

export const UI_INJECTION_ZONE: {
    PLUGIN_PAGE: 'plugin-page';
    NAVBAR_PAGE: 'navbar-page';
    RUNDOWN_ITEM: 'rundown-item';
    RUNDOWN_EDITOR: 'rundown-editor';
    RUNDOWN_SIDE: 'rundown-side';
    RUNDOWN_BOTTOM_PANEL: 'rundown-bottom-panel';
    UPLOAD_OPTIONS: 'upload-options';
    CONTEXT_MENU: 'context-menu';
};

export type UI_INJECTION_ZONE =
    (typeof UI_INJECTION_ZONE)[keyof typeof UI_INJECTION_ZONE];

// A plugin can also define its own zone for other plugins to extend, in the
// form `plugin:<owner-defined-name>`.
export type UI_INJECTION_ZONE_KEY =
    | UI_INJECTION_ZONE
    | `${UI_INJECTION_ZONE}.${string}`
    | `plugin:${string}`;

export interface Injection {
    zone: UI_INJECTION_ZONE_KEY;
    file: string;
    plugin: string;
    id: string;
}

export interface InjectionProps {
    id: string;
    props?: any;
}

/** Renders a single injection by id. */
export const Injection: React.FC<InjectionProps>;

export interface InjectionsProps {
    zone: UI_INJECTION_ZONE_KEY;
    plugin?: string | null;
    props?: any;
    fallback?: React.ReactNode;
}

/** Renders every registered injection for a zone. */
export const Injections: React.FC<InjectionsProps>;

// ---------------------------------------------------------------------------
// Undo / redo
//
// See the "Plugin -> undo/redo contract" section in CLAUDE.md. There is one
// global undo/redo stack shared by the host and every plugin — `apply`
// closures must be self-contained (read/write through `ctx.api`, never
// component state that can go stale after unmount).
// ---------------------------------------------------------------------------

// Either an i18n key (bare host key, prefixed with `undo.labels.`, or a
// `namespace:key` plugin key resolved via i18next directly) with optional
// interpolation params, or a raw `text` string shown verbatim.
export type UndoLabel =
    | { key: string; params?: Record<string, string | number>; text?: never }
    | { key?: never; params?: never; text: string };

export interface UndoContext {
    api: ManagerApi;
    direction: 'undo' | 'redo';
    entry: UndoEntry;
}

export type UndoApply<T = unknown> = (
    state: T,
    ctx: UndoContext,
) => Promise<unknown> | void;

export interface UndoEntry<T = unknown> {
    label: UndoLabel;
    scopes: string[];
    prev: T;
    next: T;
    apply: UndoApply<T>;
    ts: number;
    failCount?: number;
}

// `scopes`/`invalidateKeys`/`keys` below are always plain, unscoped keys
// (e.g. `slide:${id}`, not `plugin:my-plugin:slide:${id}`) — the wrapper
// applies the `plugin:<pluginName>:` prefix itself.
export interface PluginUndoAPI {
    /** Namespaces a plugin-owned key under `plugin:<pluginName>:`. */
    scope(key: string): string;
    record<T>(entry: Omit<UndoEntry<T>, 'ts'>): void;
    recordBarrier(label: UndoLabel, invalidateKeys: string[]): void;
    /** Drops any of this plugin's stack entries touching these keys — call
     *  from a listener on the plugin's own broadcast topic when another
     *  client's write changes state an entry depends on. */
    invalidate(keys: string[]): void;
}

export function createPluginUndo(pluginName: string): PluginUndoAPI;

export class UndoStaleError extends Error {}

export function omitId<T extends { id: string }>(obj: T): Omit<T, 'id'>;

export function request(
    conn: ManagerApi,
    opts: { path: string; method: string; data: unknown },
): Promise<void>;

export function requestOk(
    conn: ManagerApi,
    path: string,
    method: string,
    data: unknown,
): Promise<boolean>;

export function okData<T>(
    res: { status?: number; data?: unknown } | undefined,
): T | null;

export function rekeyId(
    oldId: string,
    newId: string,
    scope: (id: string) => string,
    entry?: UndoEntry,
): void;

/** Resolves a possibly-stale (temp) id through the undo store's id-alias map. */
export function liveId(id: string): string;
