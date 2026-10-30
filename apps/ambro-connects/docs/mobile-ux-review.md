# Mobile UX review

Reviewed on 30 October 2026. This pass improves the browser app; native Android APK and iOS packaging remain future work.

## Changes

- Navigation now supports mobile touch targets, safe-area spacing, keyboard focus and tablet menu transitions.
- Discovery uses a compact directory with persistent filters. Member profiles have clearer connection calls to action.
- Forms provide clearer validation and save feedback. Profile drafts are scoped to the user and browser tab, with restore, discard and save controls.
- Approval queues use compact cards and disclosures to keep profile, membership and review decisions manageable on small screens.

## Verified

The home, login, join, discover, how-to-use, privacy, member profile, account, connections and admin routes passed checks at **320, 360, 390 and 430 px** widths:

- No horizontal overflow.
- Visible buttons, `a.btn` links and disclosure summaries have touch targets at least 44 px high.
- Text inputs use at least 16 px text.

The tablet menu was checked at 820 px, including resizing to 1100 px.

Protected interactions were checked through fictional, in-memory local QA scenarios: leaving and returning to a profile draft; restoring, discarding and saving it; retaining an unfinished payment reference; submitting membership details while preserving profile edits; accepting connections; submitting reviews; profile approval and rejection validation; and hiding or showing demo profiles. **These mobile flow checks made no real database or Auth writes.** They verify UI behavior, not email delivery or live payment processing.

## Repeat the local checks

From `apps/ambro-connects`, run the production app in one terminal:

```sh
npm run build
npm run start
```

In another terminal, start the fixture proxy:

```sh
node scripts/mobile-qa-proxy.cjs
```

The app listens on port 3010; use the proxy on **127.0.0.1:3011** for protected-flow QA:

- `http://127.0.0.1:3011/__qa/admin?reset=1`
- `http://127.0.0.1:3011/__qa/global?next=/connections`
- `http://127.0.0.1:3011/__qa/china?next=/connections`
- `http://127.0.0.1:3011/__qa/expired`
- `http://127.0.0.1:3011/__qa/anonymous`

`reset=1` restores all fictional fixtures. The proxy handles every `/api/*` request locally, blocks unsupported writes, and does not forward cookies or authorization to the app. Its scenario cookie is unrelated to Supabase sessions. Production mode is preferred: the proxy does not forward development HMR WebSocket upgrades. Stop both local processes when finished; this script is not a production authentication route.
