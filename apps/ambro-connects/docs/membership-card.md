# Personal membership card

The Membership tab presents a personal Ambro Connects card: engraved silver for Global, jade with foil detail for China. The card uses the existing member name, account identifier, joined date and membership data. Its short `AC-G`/`AC-C` reference is derived from the account UUID for display; it is not an access credential.

The card has a single entry animation and light sweep, a tap/keyboard flip, and pointer tilt on fine-pointer devices. Touch gestures keep native vertical scrolling. Reduced-motion preferences remove the entry, sweep, tilt and flip transition. No new dependency or device permission is needed.

The inactive face is both `aria-hidden` and `inert`. Native controls sit outside the transformed faces so keyboard focus stays in place. Full plan/review details remain readable below the card.

Membership periods and access are separate. A recorded current period with profile review pending displays that hold, retains its end date and explains that another payment is not needed for that period. Suspended accounts show the team note/help and cannot open renewal instructions. Active membership stays active while a renewal request awaits approval. A missing current period is labeled inactive, since the API cannot distinguish never activated from previously expired.

All approval, renewal and manual-reference submission rules remain enforced by the existing backend. This change does not add payment processing, physical cards, bank-card numbers or wallet provisioning.

Verification: production build and TypeScript passed; 28 mobile viewport/state combinations (320, 360, 390 and 430 px across seven membership states) passed for both faces, touch targets, text bounds, and horizontal overflow. Keyboard Enter/Space flip, stable focus, hidden-face exclusion, a 100-character member name, desktop pointer tilt, and active-card renewal feedback were checked with the local in-memory fixtures. No live account, payment or database record was changed during these interaction checks.
