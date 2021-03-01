import { Graph, resolveGraph } from "./graph";
import {
	getObservable,
	hasCtorConfiguration,
	setCtorAutoConfigure,
} from "../types/utils/lookup";
import { Configuration } from "../index";

export default class Observable {
	constructor(opts?: {
		graph?: Graph;
		configuration?: Configuration<unknown>;
	}) {
		if (!opts?.configuration && !hasCtorConfiguration(this.constructor)) {
			setCtorAutoConfigure(this.constructor);
		}
		return getObservable(this, resolveGraph(opts?.graph), opts?.configuration);
	}
}
