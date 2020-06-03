import Graph from "../../graph";
import Atom from "../../nodes/atom";
import AtomMap from "./AtomMap";

const administrationMap: WeakMap<object, Administration> = new WeakMap();

export function getAdministration(obj: unknown): Administration | undefined {
	return administrationMap.get(obj as object);
}

export default class Administration<T extends object = object> {
	readonly proxy: T;
	readonly source: T;
	readonly graph: Graph;
	readonly atom: Atom;
	readonly proxyTraps: ProxyHandler<T> = {
		preventExtensions(): boolean {
			throw new Error(`lobx: observable objects cannot be frozen`);
			return false;
		}
	};
	protected valuesMap?: AtomMap<unknown>;
	private forceObservedAtoms: Atom[] = [];

	constructor(source: T, graph: Graph) {
		this.atom = new Atom(graph);
		this.source = source;
		this.proxy = new Proxy(this.source, this.proxyTraps) as T;
		this.graph = graph;
		administrationMap.set(this.proxy, this);
		administrationMap.set(this.source, this);
	}

	protected flushChange(): void {
		if (this.forceObservedAtoms.length) {
			this.graph.transaction(() => {
				for (let i = 0; i < this.forceObservedAtoms.length; i++) {
					this.forceObservedAtoms[i].reportChanged();
				}
			});
			this.forceObservedAtoms = [];
		}
	}

	forceChange(): void {
		this.atom.reportChanged();
	}

	forceObserve(): void {
		const atom = new Atom(this.graph);
		this.forceObservedAtoms.push(atom);
		atom.reportObserved();
	}

	onObservedStateChange(
		callback: (observing: boolean) => void,
		key: unknown
	): () => void {
		let atom: Atom = this.atom;

		if (key) {
			if (!this.valuesMap) {
				throw new Error(
					"lobx: onBecomeObserved with key not supported on this type."
				);
			}

			atom = this.valuesMap.getOrCreate(key);
		}
		return this.graph.onObservedStateChange(atom, callback);
	}
}
