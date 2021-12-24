import { Configuration } from "../types/utils/configuration";
import { setCtorConfiguration } from "../types/utils/lookup";
import Observable from "./ObservableClass";

export default function decorate<T extends typeof Observable>(
	config: Configuration<InstanceType<T>>,
	ObservableCtor: T
): T {
	setCtorConfiguration(ObservableCtor, config);

	return ObservableCtor;
}
