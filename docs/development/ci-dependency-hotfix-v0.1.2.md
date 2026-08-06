# CI dependency hotfix v0.1.2

## Failure observed

GitHub Actions run `31065341006` failed during `npm install` with:

```text
npm error code ETARGET
npm error notarget No matching version found for vite-plugin-pwa@1.1.1.
```

The typecheck, tests, build, and artifact upload steps did not run.

## Fix

- Root package version: `0.1.1` → `0.1.2`
- `vite-plugin-pwa`: `1.1.1` → `1.3.0`

No gameplay rule, Game Core behavior, XState flow, Phaser scene, Vue UI, or asset was changed.

## Required validation

After this patch reaches `main`, Big Money CI must complete:

1. dependency installation;
2. repository verification;
3. structure verification;
4. TypeScript checks;
5. Vitest tests;
6. Vite production build;
7. `apps/web/dist` artifact upload.

Phase 1.2 must not begin until the run is green or the next concrete failure is fixed.
