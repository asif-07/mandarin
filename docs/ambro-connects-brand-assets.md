# Ambro Connects brand asset integration

The October 2026 update adds a casual portrait based on Hamras’s supplied photographs and a transparent PNG logo. Keep the established forest green (`#183f35`), vermilion (`#c3492b`) and warm paper (`#f7f6f2`) palette. Product name remains **Ambro Connects**; **Ambro Connect China** and **Ambro Connect Global** are membership names.

## Placement

- Use one clean, natural-looking black-polo portrait as the main personal image. Remove screenshot chrome, captions, decorative lines, watermarks and app UI. Preserve his facial identity, hairstyle, complexion and casual clothing. Avoid generating apparent business accomplishments, awards or affiliations.
- The strongest home-page treatment is a portrait in the existing hero frame, with a quiet identity caption: **Hamras · Ambro** and **Founder, Mandarin Roots**. Avoid placing floating cards or large slogans across his face. Keep a visible portion of his hands if they remain naturally framed; do not crop at a wrist.
- If retaining the Guangzhou city hero, replace the `MR` hero-credit circle with a 40–44px portrait avatar and put the larger photo beside the founder section. Do not scatter the same large portrait throughout the landing page.
- For a portrait hero, reduce the current 150px upper-left corner to approximately 72–96px so it does not cut into his head. Start `object-position` near `55% 32%`, then assess the actual asset. Use separate mobile positioning when needed.
- Preserve the reading order: headline, explanation, main action, Ambro credit, image. A founder section image should stack before its text on mobile.

## Logo system

- Replace the CSS `a↗` wordmark in the shared `Brand` component with the PNG asset so header and footer use the same mark.
- Trim empty transparent padding. Preserve the logo’s aspect ratio; use explicit image width and height. The visible horizontal lockup should occupy about 148–164px in the desktop header and 120–132px on mobile, while retaining a minimum 44px link target.
- Keep the primary green logo on warm paper. On dark backgrounds use an intentionally prepared light variant rather than CSS filters.
- Use a separate square symbol PNG for the favicon/app icon and decorative orbit centerpiece. Do not squeeze the full wordmark into the existing 80–92px orbit tile or favicon.
- Remove obsolete CSS text-logo rules after replacing all instances. Keep the home link’s accessible name **Ambro Connects home**; the logo may then use an empty alt string within that named link.
- Deliver the full-resolution transparent PNG for download as well as the optimized web copy. Keep the source portrait and app UI screenshots out of `public`.

## Visual QA

- Review at 360px, 390px, 768px and 1440px. Confirm header logo, Join action and menu fit without collision or horizontal scrolling.
- Confirm the face remains visible at each width, the photo does not stretch and no social-media overlays remain. Check fingers, eyewear, face and clothing seams after generated cleanup.
- Inspect the PNG on white, paper and green backgrounds. Confirm real alpha transparency with no white rectangle, fringe or checkerboard baked into the image. Check small-size lettering readability.
- Confirm the same logo appears in header, footer, browser icon and any decorative brand tile. Keep decorative images hidden from screen readers.
- Check that image downloads and image URLs load on the deployed domain, then verify home, mobile menu, Join and Discover still work.
- Keep the founder’s poetic “The people” line attributed to **The Ambro Connects spirit**, as current code does; do not turn it into a verified personal quotation.

This update has no authentication, database or membership-policy changes.

## Final implementation and files

Built-in ImageGen was used for both assets, followed only by mechanical trimming, resizing and PNG/WebP encoding for web delivery. No provider API key or fallback CLI was used.

- `apps/ambro-connects/assets/brand/ambro-portrait-master.png`: full-resolution cleaned photo.
- `apps/ambro-connects/assets/brand/ambro-connects-logo-master.png`: full-resolution generated transparent logo.
- `apps/ambro-connects/public/brand/ambro-connects-logo.png`: trimmed transparent downloadable PNG (1976 × 488).
- `apps/ambro-connects/public/brand/ambro-connects-logo-web.png`: 640px optimized PNG for header/footer.
- `apps/ambro-connects/public/brand/ambro-connects-symbol.png`: extracted symbol for the orbit tile.
- `apps/ambro-connects/public/brand/ambro-portrait.webp`: optimized portrait for hero and small founder credit.
- `apps/ambro-connects/src/app/icon.png` and `apple-icon.png`: symbol-based browser/app icons.

The supplied screenshots remain untouched in Downloads and are not published. The photograph is an AI-cleaned adaptation of IMG_0899.PNG, not an assertion of a newly photographed trip or event. Face, clothing and casual subject context were retained; screenshot overlays were removed and the surrounding scene reconstructed.

## Final prompt set

### Portrait — identity-preserve

Edit the supplied IMG_0899.PNG showing the man in a black polo, sunglasses and gray jeans holding a phone and blue coffee cup on a leafy Guangzhou street. Remove all Instagram app UI, typography, captions, badges, dashed yellow lines, avatar stamps, watermarks and overlays, reconstructing the scene naturally. Preserve this exact man's identity, facial structure, hair, beard, sunglasses, build, black polo, gray jeans, wristwatch, casual pose, phone and coffee cup. Do not turn him into a different person or retouch him into a model. Natural editorial photo with real skin and clothing texture, warm daylight, softly focused green street trees and understated city traffic. Vertical 4:5 composition showing head through mid-thigh, subject centered with comfortable headroom and face large enough for a hero. Remove visible shirt emblem and readable cup/background branding. No suit, studio cutout, illustration, text, logo or UI. Ordinary photograph filling the canvas.

### Logo — logo-brand

One professional transparent PNG identity for Ambro Connects, a premium approachable people network connecting China and the world. Horizontal lockup, actual alpha transparency, no drawn checkerboard. Distinctive compact emblem at left: two interwoven rounded loop shapes suggesting lowercase a and c connected together, with a subtle northeast connection stroke. Bold simple geometry, strong silhouette, deep forest green #183F35 and warm vermilion #C3492B. Beside emblem, exact lowercase geometric sans wordmark: ambro on the first line and connects on the second, both deep forest green, ambro a little larger, heavy but warm with optical spacing. Emblem and stacked wordmark matched total height, legible at 150px. Roughly 3:1, tightly framed with modest clear space. Crisp vector-like raster artwork only. No mockups, shadows, 3D, borders, duplicate concepts, taglines, Chinese characters, airplane icons, flags or maps.
