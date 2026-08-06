# Big Money CI hotfix v0.1.3 upload

1. Open `fryjin/bigmoney` on branch `main`.
2. Use **Add file → Upload files**.
3. Upload the contents inside this folder to the repository root.
4. Confirm that root `package.json` is replaced.
5. Confirm that `docs/development/ci-typescript-compatibility-hotfix-v0.1.3.md` is added.
6. Commit message:

```text
fix: pin TypeScript 6 for vue-tsc compatibility
```

7. Open **Actions → Big Money CI** and wait for the new run.

This patch changes only development-tool compatibility. It does not modify game logic or UI.
