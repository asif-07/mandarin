# Ambro Connects

Independent Next.js member network in the Mandarin Roots repository. Mandarin Roots staff authentication and operational data are separate.

## Run

```sh
cd apps/ambro-connects
npm ci
cp .env.example .env.local
npm run dev
```

Set the new Ambro Connects Supabase project URL and publishable key in `.env.local`. The app does not need a service-role key. Local port: 3010. `npm run build` runs the production build and TypeScript check.

## Infrastructure

- Vercel project: `apasifameen-1496s-projects/ambroconnects`
- Intended production alias: `https://ambroconnects.vercel.app`
- Supabase project: `bstywcpcoershtoaxjnm` (Singapore), independent from Mandarin Roots.
- Supabase auth callback: `/auth/callback`; password recovery uses `/auth/callback?next=/auth/reset`.
- Schema and rolled-back authorization tests: `supabase/`. See `supabase/README.md`.

## Membership behavior

China membership costs RMB 1,000 for a year. Global membership costs RMB 100 for a month or includes one complimentary year after an eligible Ambro trip is verified. No payment gateway, automatic billing or automatic paid renewal is enabled. Members submit a reference; administrators confirm payment or trip eligibility and activate access. Database functions compute prices, activation dates and expiry. China profiles require separate approval to appear in discovery.

Members own their profiles and media. Only active Global members may initiate introductions, to approved active China members or Global members who opt into public network visibility. China members may browse and receive requests but cannot initiate them. Existing Global profiles remain unlisted until their owner opts in. Both parties consent before account emails are disclosed to each other. Phone numbers and WhatsApp links are not displayed publicly; public text is checked at the database boundary and redacted defensively in the UI. Only senders of completed connections can review, once per connection; reviews require moderation before they affect public ratings.

The first administrator is configured in a private database bootstrap record. Their exact email must be confirmed before admin access is granted. No admin password is seeded or stored in source. Register, confirm the email, then visit `/admin`.

## Team use

The public `/how-to-use` guide covers admin sign-in, the Profiles/Memberships/Reviews queues, manual payment and trip checks, member onboarding and connections. It is linked from navigation, sign-in, My space and approvals. `/login?next=/admin` opens team sign-in; verified administrators also go straight to approvals after ordinary login. A team account needs no paid membership to approve requests. China members need both profile approval and active membership to appear publicly.

The initial administrator binding survives Auth provider metadata refreshes. The focused rolled-back `supabase/tests/admin-bootstrap.sql` checks the Auth return value, verification boundary, later writes, identity binding and trusted revocation; see `supabase/README.md` for revocation procedure.

## Review release and remaining launch setup

The user requested publication for review while arranging email. Supabase's default mail sender is limited to organization team addresses. Configure custom SMTP before inviting the public, then remove the preview notice from the signup form. Email confirmation is intentionally enabled. No external signup/confirmation email was used for QA.

Confirm the business support contact, payment instructions, cancellation/refund arrangements, trip eligibility and retention policy before paid public launch. Policies currently explain actual app behavior and identify the pending launch details. The homepage now uses an identity-preserving, AI-cleaned edit of the user-supplied black-polo photo of Hamras. The transparent PNG logo, symbol and app icons are custom brand assets. Asset provenance and prompts are in `../../docs/ambro-connects-brand-assets.md`.

The review directory includes 20 clearly labeled fictional China profiles (four each in Sourcing, Logistics, Translation, Business services and Travel) and 10 fictional Global profiles. They live in a separate demo table with no Auth accounts, contacts, ratings or testimonials, and cannot receive requests. Team dashboard → Preview data → Hide all demo profiles removes every sample from discovery without affecting real members. See `docs/demo-members.md` for repeatable seed and scoped cleanup instructions. Saved profiles currently stay on the browser/device, as the UI states. A dedicated social post feed, in-app chat, block/report workflow and payment gateway are future extensions; the current social experience is profile discovery, portfolios, requests and reviews.

## Design and assets

Content and mobile design plan: `../../docs/ambro-connects-plan.md`. Warm ivory, forest green and vermilion; Manrope and DM Sans with system-font fallbacks. Keyboard focus, reduced motion and bottom navigation are provided. Main routes were checked at desktop and 360/390 px mobile widths.

Guangzhou photo: [Unsplash source](https://unsplash.com/photos/a-city-skyline-with-a-rainbow-colored-tower-Y4f-AKaTm3I), served locally as `public/guangzhou.jpg`. The editorial quotation is explicitly labeled as the community's spirit, not presented as a testimonial or direct attributed quote.

## Deployment

Deploy from this app directory, linked to `ambroconnects`. Verify `.vercel/project.json` before any deploy; the repository root is linked to the existing Mandarin Roots deployment. Public environment variables are configured for the app, never copied from the staff project. The app is independently deployable; the root TypeScript config excludes `apps` to keep separate path aliases and dependencies out of the staff build.
