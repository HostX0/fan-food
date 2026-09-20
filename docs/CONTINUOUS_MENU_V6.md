# Continuous menu release

Base: HostX0/fan-food, main at 3203ece25e90e57b463f1756c4cc3b1fcc7a0c48.

The six featured dishes precede all eight categories in one continuous page. All 58 distinct dishes are present on first render, with 6 repeated featured cards backed by the same cart state. Category selection scrolls to the section without filtering other dishes. Passive scroll tracking highlights the visible section in the sticky category bar; horizontal tab reveal never scrolls the document. Search, price sort and favorites remain deliberate result views with a return-to-menu action.

Unchanged: prices, variants, dish images/descriptions, hero, Baghdad checkout, map/Waze links, WhatsApp recipient and footer.

## Validation

62 Node unit tests pass locally. The release is also validated by a locked dependency installation, TypeScript check, actual Next.js production build, continuous browsing tests and the existing ordering/browser regression suites before promotion to main. Results and screenshots are retained in GitHub Actions artifacts. Production checks repeat against the public Vercel URL without sending any real orders.

Browser coverage: tests/continuous-menu-browser.mjs checks all 58 dishes without tab clicks, downward/upward scroll tracking, sticky tab visibility, anchor navigation without remounting, shared featured quantities, explicit search/sort/favorites, and modal scroll restoration.
