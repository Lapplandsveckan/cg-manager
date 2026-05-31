import config from '../../util/config';
import fs from 'fs/promises';
import {UUID} from '../../util/uuid';
import path from 'path';
import {Logger} from '../../util/log';
import {noTry, noTryAsync} from 'no-try';
import {RundownActionMetadata, RundownItemDragPayload} from '@lappis/cg-manager';
import {safeMediaPath} from '../scanner/util';
import {DirectoryManager} from '../scanner/dir';

export interface RundownItem {
    id: string;
    title: string;

    type: string;
    data: any;

    metadata: {
        autoNext: boolean;
    };
}

export interface Rundown {
    id: string;
    name: string;

    items: RundownItem[];
    type?: 'rundown' | 'quick';
}

export interface RundownState {

}

export interface RundownInstance {
    rundown: Rundown;
    state: RundownState;
}

export class RundownManager {
    private rundowns = new Map<string, RundownInstance>();
    private timer: NodeJS.Timeout;
    public executor = new RundownExecutor();

    public createRundown(name: string, type?: Rundown['type']): Rundown {
        const id = UUID.generate();
        const rundown = {
            id,
            name,
            items: [],

            type,
        };

        const state = {};
        this.rundowns.set(id, {rundown, state});
        return rundown;
    }

    public getRundown(id: string): Rundown | null {
        return this.rundowns.get(id)?.rundown ?? null;
    }

    public getRundowns(): Rundown[] {
        return Array.from(this.rundowns.values()).map(({rundown}) => rundown).filter(rundown => rundown.type !== 'quick');
    }

    public getQuickActions(): Rundown[] {
        return Array.from(this.rundowns.values()).map(({rundown}) => rundown).filter(rundown => rundown.type === 'quick');
    }

    public async updateRundown(id: string, name: string) {
        const rundown = this.getRundown(id);
        if (!rundown) return;

        rundown.name = name;
        await this.saveRundown(rundown);
    }

    // Tolerant read: returns the parsed rundown, or null if the file is
    // missing, empty, or doesn't have the expected shape. Empty files happen
    // when a save is interrupted by power loss after the OS truncated the
    // file but before the new bytes were durably written — atomic save
    // (saveRundown) prevents this going forward, but we still need a tolerant
    // reader for files that pre-date the fix.
    private async parseRundownFile(p: string): Promise<Rundown | null> {
        const [err, content] = await noTryAsync(() => fs.readFile(p, 'utf8'));
        if (err) return null;
        if (!content.trim()) return null;

        const [parseErr, parsed] = noTry(() => JSON.parse(content));
        if (parseErr) {
            Logger.error(`Failed to parse rundown (${p}): ${parseErr.message}`);
            return null;
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
            Logger.error(`Rundown (${p}) has unexpected shape — skipping`);
            return null;
        }
        return parsed as Rundown;
    }

    private async readWithRecovery(file: string): Promise<Rundown | null> {
        const dir = config['rundown-dir'];
        const primary = path.join(dir, file);
        const tmp = `${primary}.tmp`;

        const direct = await this.parseRundownFile(primary);
        if (direct) {
            // Stale .tmp from a crashed save that landed at the primary path
            // earlier (or from before this code shipped) — remove so it
            // doesn't shadow a future recovery attempt.
            await noTryAsync(() => fs.unlink(tmp));
            return direct;
        }

        const recovered = await this.parseRundownFile(tmp);
        if (recovered) {
            Logger.warn(`Recovering rundown ${file} from .tmp — primary file was empty/corrupt`);
            const [renameErr] = await noTryAsync(() => fs.rename(tmp, primary));
            if (renameErr) Logger.error(`Failed to commit recovered .tmp: ${renameErr.message}`);
            return recovered;
        }

        Logger.error(`Rundown ${file} is empty/corrupt and no .tmp recovery is available — skipping`);
        return null;
    }

    public async loadRundowns() {
        const dir = config['rundown-dir'];
        const [err, files] = await noTryAsync(() => fs.readdir(dir));
        if (err) {
            Logger.error('Failed to read rundown dir');
            Logger.error(err);
            return;
        }

        const jsonFiles = files.filter(file => file.endsWith('.json'));
        const rundowns = await Promise.all(jsonFiles.map(file => this.readWithRecovery(file)));

        rundowns
            .filter((r): r is Rundown => Boolean(r))
            .forEach(rundown => this.rundowns.set(rundown.id, {rundown, state: {}}));
    }

    public startAutosave() {
        this.timer = setInterval(() => this.saveAllRundowns(), 1000 * 60);
    }

    public stopAutosave() {
        clearInterval(this.timer);
    }

    public async saveRundown(rundown: Rundown) {
        const dir = config['rundown-dir'];
        const file = path.join(dir, `${rundown.id}.json`);
        const tmp = `${file}.tmp`;

        const content = JSON.stringify(rundown, null, 2);

        // Atomic save: write to a sibling .tmp + fsync so the bytes are
        // durable on disk, then atomically rename over the primary file.
        // A crash before rename leaves the primary intact; a crash after
        // leaves the new content in place. The previous fs.writeFile path
        // truncated the file first, so a power loss between truncate and
        // write left a 0-byte file with the rundown gone — that's what
        // readWithRecovery now defends against by also probing .tmp.
        const [openErr, fh] = await noTryAsync(() => fs.open(tmp, 'w'));
        if (openErr) {
            Logger.error(`Failed to open rundown tmp (${tmp})`);
            Logger.error(openErr);
            return;
        }

        const [writeErr] = await noTryAsync(() => fh.writeFile(content));
        if (!writeErr) await noTryAsync(() => fh.sync());
        await noTryAsync(() => fh.close());

        if (writeErr) {
            Logger.error(`Failed to write rundown ${rundown.id} (${file})`);
            Logger.error(writeErr);
            await noTryAsync(() => fs.unlink(tmp));
            return;
        }

        const [renameErr] = await noTryAsync(() => fs.rename(tmp, file));
        if (renameErr) {
            Logger.error(`Failed to commit rundown ${rundown.id} (${file})`);
            Logger.error(renameErr);
            await noTryAsync(() => fs.unlink(tmp));
        }
    }

    public async saveAllRundowns() {
        await Promise.all(Array.from(this.rundowns.values()).map(({rundown}) => this.saveRundown(rundown)));
    }

    public async deleteRundown(id: string) {
        this.rundowns.delete(id);

        const dir = config['rundown-dir'];
        const file = path.join(dir, `${id}.json`);

        const [err] = await noTryAsync(() => fs.unlink(file));
        if (!err || err['code'] === 'ENOENT') return;

        Logger.error(`Failed to delete rundown ${id} (${file})`);
        Logger.error(err);
    }
}

type ActionHandler = (item: RundownItem) => Promise<void> | void;

interface ActionEntry {
    handler: ActionHandler;
    /** Plugin that registered this action. `null` when an internal caller
     *  registers without a plugin context — those actions stay registered
     *  for the process lifetime. */
    owner: string | null;
    /** Optional descriptor + file-drop predicate. See `@lappis/cg-manager`. */
    metadata: RundownActionMetadata | null;
}

/** Serializable view of a registered action. Sent to the browser by
 *  GET /api/rundown/actions so the rundown drop overlay can do a coarse
 *  client-side filter on dragenter — the authoritative match still runs
 *  through POST /api/rundown/actions/match. */
export interface RundownActionDescriptor {
    id: string;
    fileTypes?: string[];
    destination?: string;
}

export interface RundownFileMatchInput {
    name: string;
    type: string;
    size: number;
}

export interface RundownFileMatchResult {
    actionId: string;
    payload: RundownItemDragPayload;
    /** Server-side path the file should be uploaded to. */
    path: string;
    /** Media-scanner id the file will receive once the scanner picks it
     *  up — same value AMCP expects (e.g. PLAY 1-10 MYPLUGIN/INTRO). */
    mediaId: string;
    /** Destination prefix the action declared (or "" for media root). */
    destination: string;
}

/** Derive a media-scanner id from a path that's already relative to the
 *  media root. Mirrors `getId(mediaRoot, absPath)` in scanner/util.ts —
 *  kept inline here to avoid pulling the scanner module into the rundown
 *  module. If the scanner's conversion rules change, update both. */
function relPathToMediaId(relPath: string): string {
    return relPath
        .replace(/\.[^/.]+$/, '')
        .replace(/\\+/g, '/')
        .toUpperCase();
}

export class RundownExecutor {
    private actions = new Map<string, ActionEntry>();

    public getActionTypes() {
        return Array.from(this.actions.keys());
    }

    /** Like getActionTypes, but each entry carries the slice of metadata
     *  that's safe to send to the browser. The `match` predicate is
     *  intentionally omitted — it isn't serializable and only runs in
     *  matchFile() below. */
    public getActionDescriptors(): RundownActionDescriptor[] {
        const out: RundownActionDescriptor[] = [];
        for (const [id, entry] of this.actions) {
            const accepts = entry.metadata?.accepts;
            out.push({
                id,
                fileTypes: accepts?.fileTypes,
                destination: accepts?.destination,
            });
        }
        return out;
    }

    /** Run every registered action's accepts.match against the given file.
     *  Returns one result per action that claimed the file, in registration
     *  order. A predicate that throws is logged and skipped — one buggy
     *  plugin can't break the whole match. */
    public async matchFile(file: RundownFileMatchInput): Promise<RundownFileMatchResult[]> {
        const matches: RundownFileMatchResult[] = [];
        const mediaRoot = DirectoryManager.getManager()['mediaPath'];
        for (const [id, entry] of this.actions) {
            const accepts = entry.metadata?.accepts;
            if (!accepts?.match) continue;

            const destination = accepts.destination ?? '';
            // Resolve to an ASCII-safe, non-colliding path so the mediaId
            // we return to the client matches the on-disk filename the
            // scanner will pick up. Doing this once per action keeps the
            // file.path / file.mediaId the predicate sees consistent with
            // what the upload will land at. file.name stays raw so the
            // plugin can use it for the display title.
            const filePath = await safeMediaPath(destination + file.name, mediaRoot);
            const mediaId = relPathToMediaId(filePath);

            // TODO: drop the cast once @lappis/cg-manager publishes a
            //       version whose `match` signature includes `mediaId`.
            const matchFn = accepts.match as (file: {
                name: string;
                type: string;
                size: number;
                path: string;
                mediaId: string;
            }) => RundownItemDragPayload | null;
            const [err, payload] = noTry(() => matchFn({
                name: file.name,
                type: file.type,
                size: file.size,
                path: filePath,
                mediaId,
            }));
            if (err) {
                Logger.warn(`Action ${id} accepts.match threw: ${err.message}`);
                continue;
            }
            if (!payload) continue;

            matches.push({actionId: id, payload, path: filePath, mediaId, destination});
        }
        return matches;
    }

    // `owner` is passed by `PluginAPI.registerRundownAction` (in
    // @lappis/cg-manager) so the host can clean the action up when the
    // owning plugin is disabled. Optional to keep the signature usable by
    // internal callers that aren't tied to a plugin. `metadata` opts the
    // action into the file-drop pipeline (see matchFile above).
    public registerAction(
        type: string,
        action: ActionHandler,
        owner?: string,
        metadata?: RundownActionMetadata,
    ) {
        this.actions.set(type, {
            handler: action,
            owner: owner ?? null,
            metadata: metadata ?? null,
        });
    }

    public unregisterActionsByOwner(name: string) {
        for (const [type, entry] of this.actions)
            if (entry.owner === name) this.actions.delete(type);
    }

    public async executeItem(item: RundownItem) {
        const entry = this.actions.get(item.type);
        if (!entry) {
            Logger.warn(`Unknown action type: ${item.type}`);
            return;
        }

        await entry.handler(item);
    }
}