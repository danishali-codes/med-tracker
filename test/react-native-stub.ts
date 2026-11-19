// Minimal stand-in for react-native in unit tests (vitest can't load the real one).
export const Platform = { OS: 'android' };
export const Image = { resolveAssetSource: () => ({ uri: '' }) };
export const NativeModules = {};
export const TurboModuleRegistry = { get: () => null, getEnforcing: () => ({}) };
export const AppRegistry = { registerHeadlessTask: () => {} };
export const StyleSheet = { create: <T>(s: T) => s, flatten: (s: unknown) => s };
const Noop = () => null;
export const ActivityIndicator = Noop;
export const FlatList = Noop;
export const Text = Noop;
export const TouchableNativeFeedback = Noop;
export const View = Noop;
