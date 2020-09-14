import { getAdministration } from "../types/utils/lookup";
import { PromiseAdministration } from "../types/promise";
import { Graph, resolveGraph } from "./graph";

export function task<T>(p: Promise<T>, opts?: { graph: Graph }): Promise<T> {
	let adm = getAdministration(p);

	if (adm && !adm.useAction) {
		throw new Error(
			"this promise has already been wrapped with `transactionTask`"
		);
	} else if (!adm) {
		adm = new PromiseAdministration(p, resolveGraph(opts?.graph), true);
	}

	return adm.proxy as Promise<T>;
}

export function transactionTask<T>(
	p: Promise<T>,
	opts?: { graph: Graph }
): Promise<T> {
	let adm = getAdministration(p);

	if (adm && !adm.useAction) {
		throw new Error("this promise has already been wrapped with `task`");
	} else if (!adm) {
		adm = new PromiseAdministration(p, resolveGraph(opts?.graph));
	}

	return adm.proxy as Promise<T>;
}
