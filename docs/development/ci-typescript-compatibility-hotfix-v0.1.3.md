# CI TypeScript compatibility hotfix v0.1.3

## Failure observed

GitHub Actions run `31065644878` successfully completed dependency installation, repository verification, and structure verification. It then failed in the web workspace typecheck:

```text
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]:
Package subpath './lib/tsc' is not defined by "exports"
in node_modules/typescript/package.json
```

The failure occurred when `vue-tsc 3.3.8` attempted to run against `typescript 7.0.2`.

## Fix

- Root package version: `0.1.2` → `0.1.3`
- TypeScript: `7.0.2` → `6.0.3`
- Keep `vue-tsc` at `3.3.8`
- Keep `vite-plugin-pwa` at `1.3.0`

TypeScript 7 changed package export behavior used by the current `vue-tsc` wrapper. Phase 1.1 does not require TypeScript 7 features, so the stable corrective action is to pin the compiler to the latest TypeScript 6 release until Vue language tooling explicitly supports TypeScript 7.

No gameplay rule, domain behavior, XState flow, Phaser scene, Vue component, storage format, or asset was changed.

## Required validation

After upload, Big Money CI must complete:

1. dependency installation;
2. repository verification;
3. structure verification;
4. all workspace typechecks;
5. all Vitest suites;
6. Vite production build;
7. `apps/web/dist` artifact upload.

If another failure appears after typecheck begins, diagnose that concrete error rather than changing multiple dependency versions at once.
