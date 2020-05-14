import Administration from "./utils/Administration";
import Graph from "../graph";
import { getAdministration, patchPromise } from "./utils/lookup";

export class PromiseCtorAdministration extends Administration<typeof Promise> {
	readonly useAction: boolean;

	constructor(source: typeof Promise, graph: Graph, useAction = false) {
		super(source, graph, promiseConstructorProxyTraps);
		this.useAction = useAction;
	}
}

const promiseConstructorProxyTraps: ProxyHandler<typeof Promise> = {
	construct(target: typeof Promise, args: unknown[]) {
		const adm = getAdministration(target);
		const instance = Reflect.construct(target, args);

		return new PromiseAdministration(instance, adm.graph, true).proxy;
	}
};

export class PromiseAdministration extends Administration<Promise<unknown>> {
	readonly useAction: boolean;

	constructor(source: Promise<unknown>, graph: Graph, useAction = false) {
		super(source, graph, promiseProxyTraps);
		this.useAction = useAction;
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

const promiseProxyTraps: ProxyHandler<Promise<unknown>> = {
	get(target: Promise<unknown>, name: string | number | symbol) {
		if (name in promiseMethods) {
			return promiseMethods[name];
		}

		return target[name];
	}
};
