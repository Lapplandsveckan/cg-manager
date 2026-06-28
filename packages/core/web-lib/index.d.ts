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
 * A drift guard in cg-manager (`src/web/src/lib/__typecheck__.ts`) fails the
 * build if these declarations diverge from the real exports — keep them in
 * sync there, not by guessing here.
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
// Socket / ManagerApi
//
// The real `ManagerApi` (cg-manager `src/web/src/lib/api/api.ts`) is large and
// pulls in the rest-exchange-protocol client transitively. We declare the
// members plugins actually reach for; the rest stay broad on purpose. Tighten
// here as plugin usage grows.
// ---------------------------------------------------------------------------

export interface CasparServerApi {
    on(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    getMedia(): Promise<Map<string, MediaDoc>>;
    deleteMedia(id: string): Promise<void>;
    renameMedia(id: string, newName: string): Promise<void>;
}

export interface RoutesApi {
    register(...args: any[]): any;
    unregister(...args: any[]): any;
}

export interface ManagerApi {
    caspar: CasparServerApi;
    routes: RoutesApi;
    videoRoutes: any;
    injects: any;
    plugin: any;

    rawRequest(path: string, method: string, data: any): Promise<any>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getApiVersion(): Promise<any>;
}

export function useSocket(): ManagerApi | null | undefined;

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
