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
