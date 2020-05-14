import Administration, { getAdministration } from "./utils/Administration";
import Graph from "../graph";

export class DateAdministration extends Administration<Date> {
	constructor(source: Date, graph: Graph) {
		super(source, graph, dateProxyTraps);
	}
}

const dateMethods = Object.create(null);

function addDateSetMethod(method: string): void {
	if (!dateMethods[method])
		dateMethods[method] = function(): unknown {
			const adm = getAdministration(this)!;
			const res = adm.source[method].apply(adm.source, arguments);
			adm.atom.reportChanged();
			return res;
		};
}

function addDateGetMethod(method: string | number | symbol): void {
	if (!dateMethods[method])
		dateMethods[method] = function(): unknown {
			const adm = getAdministration(this)!;
			adm.atom.reportObserved();
			return adm.source[method].apply(adm.source, arguments);
		};
}

const dateProxyTraps: ProxyHandler<Date> = {
	get(target: Date, name: string | number | symbol) {
		if (typeof target[name] === "function") {
			if (typeof name === "string" && name.startsWith("set")) {
				addDateSetMethod(name);
			} else {
				addDateGetMethod(name);
			}

			return dateMethods[name];
		}

		return target[name];
	}
};
