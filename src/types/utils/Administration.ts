import Graph from "../../core/graph";
import Atom from "../../core/nodes/atom";
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
			throw new Error(`observable objects cannot be frozen`);
			return false;
		}
	};
	protected valuesMap?: AtomMap<unknown>;
	private forceObservedAtoms?: Atom[];

	constructor(source: T, graph: Graph) {
		this.atom = new Atom(graph);
		this.source = source;
		this.proxy = new Proxy(this.source, this.proxyTraps) as T;
		this.graph = graph;
		administrationMap.set(this.proxy, this);
		administrationMap.set(this.source, this);
	}

	protected flushChange(): void {
		if (this.forceObservedAtoms?.length) {
			this.graph.batch(() => {
				for (let i = 0; i < this.forceObservedAtoms!.length; i++) {
					this.forceObservedAtoms![i].reportChanged();
				}
			});
			this.forceObservedAtoms = undefined;
		}
	}

	forceChange(): void {
		this.atom.reportChanged();
	}

	forceObserve(): void {
		const atom = new Atom(this.graph);
		if (!this.forceObservedAtoms) {
			this.forceObservedAtoms = [];
		}
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
					"onBecomeObserved with key not supported on this type."
				);
			}

			atom = this.valuesMap.getOrCreate(key);
		}
		return this.graph.onObservedStateChange(atom, callback);
	}
}
