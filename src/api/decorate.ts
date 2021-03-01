import { Configuration } from "../types/object";
import { setCtorConfiguration } from "../types/utils/lookup";

export default function decorate<T extends new (...args: unknown[]) => unknown>(
	config: Configuration<InstanceType<T>>,
	ObservableCtor: T
): T {
	setCtorConfiguration(ObservableCtor, config);

	return ObservableCtor;
}
