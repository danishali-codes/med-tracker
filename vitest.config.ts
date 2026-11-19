import { defineConfig } from 'vitest/config';

const here = (p: string) => new URL(p, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      // vitest can't load react-native itself; the widget library only needs a few names from it.
      { find: /^react-native$/, replacement: here('./test/react-native-stub.ts') },
      { find: /^react-native-android-widget$/, replacement: here('./node_modules/react-native-android-widget/lib/module/index.js') },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: { server: { deps: { inline: ['react-native-android-widget'] } } },
});
