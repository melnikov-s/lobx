import Administration, { getAdministration } from "./utils/Administration";
import Graph from "../graph";

export class DateAdministration extends Administration<Date> {
	constructor(source: Date, graph: Graph) {
		super(source, graph);
		this.proxyTraps.get = (_, name) => this.proxyGet(name);
	}

	private proxyGet(name: string | number | symbol): unknown {
		if (typeof this.source[name] === "function") {
			if (typeof name === "string" && name.startsWith("set")) {
				addDateSetMethod(name);
			} else {
				addDateGetMethod(name);
			}

			return dateMethods[name];
		}

		return this.source[name];
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
