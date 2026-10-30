# Fictional demo directory

This optional content pack contains **30 fictional people**: 20 Ambro Connect China profiles and 10 Ambro Connect Global profiles. It lets reviewers explore the member experience before the network fills with real members.

Every profile includes a complete introduction, city, fictional company, specialties, languages, three illustrative achievements, and two portfolio concepts. There are no contact details, Auth accounts, credentials, paid memberships, bookings, ratings, or customer reviews. These profiles cannot send or receive real introductions.

The directory API labels them `is_demo: true`, with `verified: false`, `rating: null`, `review_count: 0`, and `completed_connections: 0`. The interface must preserve the visible fictional-demo label. Bios also begin “Fictional demo profile,” companies begin “Demo,” and portfolio descriptions explicitly identify fictional projects.

## Inventory

| China segment | Fictional members | Count |
| --- | --- | ---: |
| Sourcing | Lin Qiao, Jun Wei, Mei An, Rui Chen | 4 |
| Logistics | Tao Wen, Yuna Luo, Bo Han, Xia Ning | 4 |
| Translation | An Li, Ning Xu, Hana Zhou, Wei Su | 4 |
| Business services | Jia Song, Yue Tan, Kai Lu, Min He | 4 |
| Travel | Lan Yu, Chen Mo, Yun Fei, Qing Zhao | 4 |

The primary China specialties exactly match the directory’s five segment filters. All 20 China profiles use China cities.

| Global member | Location | Main interest |
| --- | --- | --- |
| Maya Nair | Kochi, India | Sourcing / homeware |
| Omar Faris | Dubai, UAE | Sourcing / furniture |
| Sofia Duarte | Lisbon, Portugal | Sourcing / product design |
| Daniel Okoye | Lagos, Nigeria | Logistics / trade planning |
| Aisha Rahman | Kuala Lumpur, Malaysia | Business services / retail research |
| Luca Marin | Milan, Italy | Travel / design and culture |
| Priya Menon | Bengaluru, India | Sourcing / consumer electronics |
| Ethan Brooks | Melbourne, Australia | Business services / operations |
| Nadia Azlan | Singapore | Translation / cultural storytelling |
| Noah Patel | London, United Kingdom | Travel / food and culture |

These names, businesses, biographies, achievements, and projects were invented for this demonstration. Any resemblance to an actual person or business is coincidental. No real person is depicted by the artwork.

## Files and regeneration

- `scripts/demo-members.json` — the generated seed dataset, with stable namespaced UUIDs.
- `scripts/generate-demo-members.cjs` — the curated content and deterministic artwork generator.
- `scripts/seed-demo-members.sql` — one atomic, idempotent upsert into `public.demo_members` only.
- `public/demo/*` — 120 original SVG assets: an illustrated avatar, a cover, and two portfolio images per person. Assets use local `/demo/...` URLs and a forest, vermillion, and ivory palette. The images visibly identify their demo or fictional status.

From the repository root, regenerate the complete pack with:

```sh
node apps/ambro-connects/scripts/generate-demo-members.cjs
```

The generator writes files only. It does not contact a database, create users, or apply the seed. It checks the required segment counts, unique IDs, profile completeness, and local asset paths before completing. Re-running it keeps IDs stable, so the SQL upsert updates the same demo rows.

## Explicit seed operation

First apply the reviewed migration that creates the separate `public.demo_members` table and its permissions. Then review and execute `scripts/seed-demo-members.sql` against the **Ambro Connects** Supabase project using a trusted administrative database connection.

The seed is deliberately separate from automatic schema migrations and requires an explicit execution step. It has not been applied by generating this pack. It sets these 30 demo rows to `enabled = true`. Reapplying the seed restores their content and makes them visible again; do not run it as part of normal production builds.

The table contract uses the normal profile columns, plus `member_type` and `enabled`. Global city strings include their country; there is no separate country column. The portfolio JSON shape is `{ "title": "...", "description": "...", "image_url": "/demo/...svg" }`.

## Hide or remove safely

**Preferred:** use the Ambro Connects Admin demo-visibility control. It calls `public.set_demo_members_visible(false)` as the authenticated administrator and preserves the audit trail. This immediately hides the fictional directory while keeping the content available for another review. Re-enable through the same control when needed.

An administrator can also run the RPC from an authenticated application session:

```js
await supabase.rpc("set_demo_members_visible", { visible: false });
```

If direct administrative SQL is required, this is scoped to the separate demo table:

```sql
-- Hide fictional profiles only. Does not alter any real member data.
UPDATE public.demo_members SET enabled = false, updated_at = now();
```

To permanently remove the optional content after reviewing the affected row count:

```sql
-- This table contains fictional display data only.
SELECT count(*) AS fictional_rows_to_remove FROM public.demo_members;
DELETE FROM public.demo_members;
```

Do not delete from `auth.users`, `profiles`, `member_accounts`, `connections`, or `reviews` to clean up this pack. No demo data was inserted there. The local SVG files can remain harmlessly unused, or `public/demo` can be removed in a later code change after demo visibility is disabled.

## Verification performed

- Confirmed exactly four China profiles in every requested segment, 20 China total, and 10 Global.
- Confirmed unique UUIDs, three achievements, two portfolio concepts, and four local artwork files per profile.
- Parsed all 120 SVG files successfully and visually reviewed a representative contact sheet.
- Checked column lengths, required fields, local asset references, and the absence of contact or review/rating fields in the dataset.
- No seed SQL was executed as part of preparing or verifying these files.
