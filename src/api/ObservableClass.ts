import { Graph, resolveGraph } from "./graph";
import {
	getObservable,
	hasCtorConfiguration,
	setCtorAutoConfigure,
} from "../types/utils/lookup";

export default class Observable {
	constructor(opts?: { graph: Graph }) {
		if (!hasCtorConfiguration(this.constructor)) {
			setCtorAutoConfigure(this.constructor);
		}
		return getObservable(this, resolveGraph(opts?.graph));
	}
}
