/**
 * Patches the Node.js `vm` module to default `importModuleDynamically` to
 * `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER` on all vm entry points
 * (runInNewContext, runInThisContext, runInContext, compileFunction, Script).
 *
 * Without this, Next.js's `load-manifest.external.js` calls
 * `vm.runInNewContext()` with no `importModuleDynamically` option, which
 * causes Node ≥20.12/22 to throw ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
 * whenever a manifest chunk calls `import()` inside the vm context.
 *
 * Must be imported before `next` is required. Emits a one-time Node
 * ExperimentalWarning (expected/benign). No-ops on runtimes that don't have
 * USE_MAIN_CONTEXT_DEFAULT_LOADER (Node <20.12).
 */
import vm from 'vm';

// Node types define this as `number`, but the actual runtime value is a symbol.
const loader = (vm.constants as unknown as { USE_MAIN_CONTEXT_DEFAULT_LOADER?: symbol | number })
    ?.USE_MAIN_CONTEXT_DEFAULT_LOADER;

if (loader !== undefined) {
    const withLoader = (opts: unknown) => {
        if (opts && typeof opts === 'object') {
            const o = opts as { importModuleDynamically?: unknown };
            if (o.importModuleDynamically === undefined)
                (o as Record<string, unknown>).importModuleDynamically = loader;
            return o;
        }
        return { importModuleDynamically: loader };
    };

    const v = vm as unknown as Record<string, (...a: unknown[]) => unknown>;
    const sigs: [string, number][] = [
        ['runInNewContext', 2],
        ['runInThisContext', 1],
        ['runInContext', 2],
        ['compileFunction', 2],
    ];
    for (const [name, idx] of sigs) {
        const orig = v[name];
        v[name] = function (this: unknown, ...args: unknown[]) {
            args[idx] = withLoader(args[idx]);
            return orig.apply(this, args);
        };
    }

    const OrigScript = vm.Script;
    class PatchedScript extends OrigScript {
        constructor(code: string, opts?: vm.ScriptOptions) {
            super(code, withLoader(opts) as vm.ScriptOptions);
        }
    }
    (vm as unknown as { Script: unknown }).Script = PatchedScript;
}
