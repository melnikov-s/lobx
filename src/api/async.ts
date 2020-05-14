import { getAdministration } from "../core/types/utils/lookup";
import { PromiseAdministration } from "../core/types/promise";
import { Graph, resolveGraph } from "./graph";

export function asyncAction<T>(
	p: Promise<T>,
	opts?: { graph: Graph }
): Promise<T> {
	let adm = getAdministration(p);

	if (adm && !adm.useAction) {
		throw new Error(
			"lobx: this promise has already been wrapped with `asyncTransaction`"
		);
	} else if (!adm) {
		adm = new PromiseAdministration(p, resolveGraph(opts?.graph), true);
	}

	return adm.proxy as Promise<T>;
}

export function asyncTransaction<T>(
	p: Promise<T>,
	opts?: { graph: Graph }
): Promise<T> {
	let adm = getAdministration(p);

	if (adm && !adm.useAction) {
		throw new Error(
			"lobx: this promise has already been wrapped with `asyncAction`"
		);
	} else if (!adm) {
		adm = new PromiseAdministration(p, resolveGraph(opts?.graph));
	}

	return adm.proxy as Promise<T>;
}
