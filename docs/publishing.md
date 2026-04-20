# Publishing

## Build for Store

```bash
npm run prod
```

This runs a clean build and produces `nodex.zip` in the project root. Upload this zip directly to the Chrome Web Store Developer Dashboard.

## Chrome Web Store Details

- Developer account: khegai.dev@gmail.com
- GitHub: KhegaiVladimir/nodex
- Uninstall feedback URL: `https://khegaivladimir.github.io/nodex/uninstall`

## Version Bumping

Version lives in two places — keep them in sync:

1. `manifest.json` → `"version": "X.Y.Z"`
2. `package.json` → `"version": "X.Y.Z"`

Semantic versioning:
- **Patch (X.Y.Z+1):** bug fix, selector update, threshold tweak
- **Minor (X.Y+1.0):** new feature, new gesture, new UI
- **Major (X+1.0.0):** breaking architecture change, new permissions

## Permissions That Trigger Review

Adding any new permission to `manifest.json` may trigger a manual review delay (days to weeks). Current permissions (`storage`, `sidePanel`, `scripting`, `tabs`) are already approved.

If you need a new permission:
1. Document the reason in the store listing update
2. Be specific in the justification — Chrome Store reviewers reject vague explanations
3. `host_permissions` changes also trigger review

## Pre-Upload Checklist

- [ ] Version bumped in manifest.json and package.json
- [ ] `npm run prod` succeeds without errors
- [ ] nodex.zip generated
- [ ] Load unpacked from `dist/` and test full flow manually (see `docs/testing.md`)
- [ ] No `console.log` left in production-critical paths (console.error is fine)
- [ ] No hardcoded external URLs (zero network policy)
- [ ] `docs/changelog-internal.md` updated

## Review Time

New extension submission: 1–3 business days typical.
Update to existing extension: usually hours, sometimes 1 day.
If new permissions added: 1–2 weeks.
