# Menu polish v5

- Replaced the catalog-thumbnail hero with a dedicated generated, photorealistic Iraqi table scene. Local WebP variants: 800, 1440 and 2000 pixels, plus a 1200x630 sharing image. The image remains disclosed as illustrative. See `hero-v5-manifest.json` for source/job identity and asset hashes.
- Kept the existing name and Iraqi mobile fields and fixed Baghdad governorate. Combined area and nearest landmark into one required readable delivery address. The previous required area has not been silently dropped: it is now entered together with the landmark. The exact map pin and order notes remain optional.
- Removed duplicate area/landmark fields and their duplicate message lines. An order contains a single address line and, only after explicit confirmation, the Waze link. Customer information is still transient and no order is sent automatically.
- Category navigation aligns to a stable original-position anchor beneath the measured sticky header, including transitions from deep long-category scrolling to short categories. The selected tab is revealed horizontally without vertically scrolling its ancestors.
- Added subtle entrance, category fade and button feedback with reduced-motion support; no autoplay, parallax, scroll hijacking or animation library. Checkout steps return to their own heading without losing entered data.
- Catalog data, 58 products, 73 options, per-dish images, prices, favorites, quick add, decrement-to-delete behavior and the agency link are unchanged.

## Verification
Before promotion: locked npm installation, 56 unit tests, TypeScript and an actual Next.js production build passed. Browser evidence covers 31 profile/scenario runs: 8 new polish profiles plus the existing browser, checkout, quick-control, final-menu and production-style suites. Chromium, WebKit and Firefox, phone/tablet/desktop widths, standard and reduced motion were exercised. Screenshots were visually reviewed before promotion. CI re-checks the deployed production site and preserves current results as run artifacts. No real WhatsApp order is sent by these tests.
