import Administration from "./utils/Administration";
import Graph from "../graph";
import { getAdministration, patchPromise } from "./utils/lookup";

export class PromiseCtorAdministration extends Administration<typeof Promise> {
	readonly useAction: boolean;

	constructor(source: typeof Promise, graph: Graph, useAction = false) {
		super(source, graph);
		this.useAction = useAction;
		this.proxyTraps.construct = (_, args) => this.proxyConstruct(args);
	}

	private proxyConstruct(args: unknown[]): Promise<unknown> {
		const instance = Reflect.construct(this.source, args);

		return new PromiseAdministration(instance, this.graph, true).proxy;
	}
}

export class PromiseAdministration extends Administration<Promise<unknown>> {
	readonly useAction: boolean;

	constructor(source: Promise<unknown>, graph: Graph, useAction = false) {
		super(source, graph);
		this.useAction = useAction;
		this.proxyTraps.get = (_, name) => this.proxyGet(name);
	}

	private proxyGet(name: string | number | symbol): unknown {
		if (name in promiseMethods) {
			return promiseMethods[name];
		}

		return this.source[name];
	}
}

const promiseMethods = Object.create(null);

["then", "catch", "finally"].forEach(method => {
	if (Promise.prototype[method]) {
		promiseMethods[method] = function(
			this: Promise<unknown>,
			...args: Function[]
		): unknown {
			const adm = getAdministration(this)!;

			return new PromiseAdministration(
				adm.source[method].apply(
					adm.source,
					args.map(fn => {
						return (v: unknown): unknown =>
							patchPromise(
								() =>
									adm.graph[adm.useAction ? "runInAction" : "transaction"](() =>
										fn(v)
									),
								adm.graph
							);
					})
				),
				adm.graph,
				adm.useAction
			).proxy;
		};
	}
});
