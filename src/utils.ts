export function defaultEquals<T>(a: T, b: T): boolean {
	return a === b || (a !== a && b !== b);
}

export function isNonPrimitive(val: unknown): val is object {
	return val && (typeof val === "object" || typeof val === "function");
}

export function isPropertyKey(val: PropertyKey): boolean {
	return (
		typeof val === "string" ||
		typeof val === "number" ||
		typeof val === "symbol"
	);
}

export function getPropertyDescriptor(
	obj: object,
	key: PropertyKey
): PropertyDescriptor | undefined {
	let node = obj;
	while (node) {
		const desc = Object.getOwnPropertyDescriptor(node, key);
		if (desc) {
			return desc;
		}

		node = Object.getPrototypeOf(node);
	}

	return undefined;
}

declare const window: any;
declare const self: any;

const mockGlobal = {};

export function getGlobal(): any {
	if (typeof window !== "undefined") {
		return window;
	}
	if (typeof global !== "undefined") {
		return global;
	}
	if (typeof self !== "undefined") {
		return self;
	}
	return mockGlobal;
}

export function getParentConstructor(
	Ctor: Function | undefined
): Function | undefined {
	return Ctor?.prototype && Object.getPrototypeOf(Ctor.prototype)?.constructor;
}
