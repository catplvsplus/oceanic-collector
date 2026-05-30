import { defineConfig } from "tsdown";

export default defineConfig({
    entry: ['src/index.ts'],
    platform: 'node',
    format: ['esm', 'cjs'],
    target: 'esnext',
    clean: true,
    minify: false,
    dts: true,
    sourcemap: false,
    treeshake: true,
    outDir: './dist',
    tsconfig: 'tsconfig.json',
    deps: {
        skipNodeModulesBundle: true
    }
});