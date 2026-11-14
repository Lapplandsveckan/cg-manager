import { type Contribution, type PluginAPI } from '@lappis/cg-manager';
import { type RouteSourceType } from './types';

export const SOURCE_TYPES_POINT = 'routes:source-types';

/** What the source picker needs to offer a contributed type. */
export interface RouteSourceTypeInfo {
    type: string;
    label: string;
    description?: string;
    plugin: string;
}

/** Source types other plugins push in, so a route can be built on something
 *  the routes plugin has never heard of. A contributed type only exists while
 *  its plugin is enabled, which is why the set changing has to rebuild
 *  effects — that is also what gets a route going whose provider happened to
 *  load after it. */
export class RouteSourceTypes {
    private contributions: Contribution<RouteSourceType>[] = [];

    public constructor(
        private api: PluginAPI,
        private onChange: () => void,
    ) {}

    private readonly handle = (list: Contribution[]) => {
        this.contributions = list as Contribution<RouteSourceType>[];
        this.onChange();
    };

    public load() {
        this.contributions = this.api.getContributions(SOURCE_TYPES_POINT);
        this.api.onContributionsChange(SOURCE_TYPES_POINT, this.handle);
    }

    public dispose() {
        this.api.offContributionsChange(SOURCE_TYPES_POINT, this.handle);
        this.contributions = [];
    }

    public get(type: string): RouteSourceType | null {
        const match = this.contributions.find(c => c.value?.type === type);

        return match?.value ?? null;
    }

    public list(): RouteSourceTypeInfo[] {
        return this.contributions
            .filter(c => !!c.value?.type)
            .map(({ owner, value }) => ({
                type: value.type,
                label: value.label,
                description: value.description,
                plugin: owner,
            }));
    }
}
