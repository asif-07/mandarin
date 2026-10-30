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

Members own their profiles and media. Active Global members may request introductions to approved active China members. Both parties consent before account emails are disclosed to each other. Only senders of completed connections can review, once per connection; reviews require moderation before they affect public ratings.

The first administrator is configured in a private database bootstrap record. Their exact email must be confirmed before admin access is granted. No admin password is seeded or stored in source. Register, confirm the email, then visit `/admin`.

## Review release and remaining launch setup

The user requested publication for review while arranging email. Supabase's default mail sender is limited to organization team addresses. Configure custom SMTP before inviting the public, then remove the preview notice from the signup form. Email confirmation is intentionally enabled. No external signup/confirmation email was used for QA.

Confirm the business support contact, payment instructions, cancellation/refund arrangements, trip eligibility and retention policy before paid public launch. Policies currently explain actual app behavior and identify the pending launch details. The homepage now uses an identity-preserving, AI-cleaned edit of the user-supplied black-polo photo of Hamras. The transparent PNG logo, symbol and app icons are custom brand assets. Asset provenance and prompts are in `../../docs/ambro-connects-brand-assets.md`.

The directory starts empty; no invented members, ratings or testimonials are seeded. Saved profiles currently stay on the browser/device, as the UI states. A dedicated social post feed, in-app chat, block/report workflow and payment gateway are future extensions; the current social experience is profile discovery, portfolios, requests and reviews.

## Design and assets

Content and mobile design plan: `../../docs/ambro-connects-plan.md`. Warm ivory, forest green and vermilion; Manrope and DM Sans with system-font fallbacks. Keyboard focus, reduced motion and bottom navigation are provided. Main routes were checked at desktop and 360/390 px mobile widths.

Guangzhou photo: [Unsplash source](https://unsplash.com/photos/a-city-skyline-with-a-rainbow-colored-tower-Y4f-AKaTm3I), served locally as `public/guangzhou.jpg`. The editorial quotation is explicitly labeled as the community's spirit, not presented as a testimonial or direct attributed quote.

## Deployment

Deploy from this app directory, linked to `ambroconnects`. Verify `.vercel/project.json` before any deploy; the repository root is linked to the existing Mandarin Roots deployment. Public environment variables are configured for the app, never copied from the staff project. The app is independently deployable; the root TypeScript config excludes `apps` to keep separate path aliases and dependencies out of the staff build.
