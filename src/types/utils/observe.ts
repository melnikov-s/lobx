const listenerMap: WeakMap<object, ObservableListener<unknown>> = new WeakMap();

export function notifyAdd(obj: object, value: unknown, name?: unknown): void {
	listenerMap.get(obj)?.notify({
		object: obj,
		type: "add",
		name,
		newValue: value,
	});
}

export function notifyDelete(
	obj: object,
	value: unknown,
	name?: unknown
): void {
	listenerMap.get(obj)?.notify({
		object: obj,
		type: "delete",
		name,
		oldValue: value,
	});
}

export function notifyUpdate(
	obj: object,
	newValue: unknown,
	oldValue: unknown,
	name?: unknown
): void {
	listenerMap.get(obj)?.notify({
		object: obj,
		type: "update",
		name,
		oldValue,
		newValue,
	});
}

export function notifyArrayUpdate<T>(
	arr: T[],
	index: number,
	oldValue: T,
	newValue: T
): void {
	listenerMap.get(arr)?.notify({
		object: arr,
		type: "updateArray",
		index,
		oldValue,
		newValue,
	});
}

export function notifySpliceArray<T>(
	arr: T[],
	index: number,
	added: T[],
	removed: T[]
): void {
	listenerMap.get(arr)?.notify({
		object: arr,
		type: "spliceArray",
		index,
		added,
		removed,
	});
}

export function observe<T>(
	obj: object,
	method: MutationListener<T>
): () => void {
	let listener = listenerMap.get(obj) as ObservableListener<unknown>;

	if (!listener) {
		listener = new ObservableListener<unknown>();
		listenerMap.set(obj, listener);
	}

	return listener.subscribe(method as MutationListener<unknown>);
}

export type AddEvent<T> = {
	object: object;
	type: "add";
	name?: unknown;
	newValue: T;
};

export type DeleteEvent<T> = {
	object: object;
	type: "delete";
	name?: unknown;
	oldValue: T;
};

export type UpdateEvent<T> = {
	object: object;
	type: "update";
	name: unknown;
	oldValue: T;
	newValue: T;
};

export type UpdateArrayEvent<T> = {
	object: T[];
	type: "updateArray";
	index: number;
	oldValue: T;
	newValue: T;
};

export type SpliceArrayEvent<T> = {
	object: T[];
	type: "spliceArray";
	index: number;
	added: T[];
	removed: T[];
};

export type MutationEvent<T> =
	| AddEvent<T>
	| UpdateEvent<T>
	| DeleteEvent<T>
	| UpdateArrayEvent<T>
	| SpliceArrayEvent<T>;

export type MutationListener<T> = (ev: MutationEvent<T>) => void;
export type HasListener<T> = {
	listener: ObservableListener<T>;
};

export class ObservableListener<T> {
	private listeners: MutationListener<T>[] | undefined;
	private notifying: boolean = false;

	subscribe(l: MutationListener<T>): () => void {
		let unsubed = false;

		this.listeners = this.listeners || [];

		this.listeners.push(l);

		return (): void => {
			if (!unsubed) {
				if (this.notifying) {
					throw new Error(
						"Can't unsubscribe from observer during notification"
					);
				}
				const idx = this.listeners?.indexOf(l);
				if (idx != null && idx !== -1) this.listeners!.splice(idx, 1);
				unsubed = true;
			}
		};
	}

	get size(): number {
		return this.listeners?.length ?? 0;
	}

	notify(ev: MutationEvent<T>): void {
		if (!this.listeners) return;

		this.notifying = true;
		for (let i = 0; i < this.listeners.length; i++) {
			this.listeners[i](ev);
		}
		this.notifying = false;
	}
}
