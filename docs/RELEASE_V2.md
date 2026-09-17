# Fan Food · Baghdad menu update

This release retains all 58 products, 73 price/size options, eight categories, favorites,
cart persistence, item notes, explicit pasta choices and WhatsApp message review.

- Local, individually assigned WebP product photos; generated illustrations are disclosed.
- Local Arabic/English search with aliases, conservative typo tolerance and budget filters.
- Fixed Baghdad city and a visible +964 prefix; local/international/Arabic phone pastes work.
- Detailed address, landmark and delivery pin are optional. Name, phone and area are required.
- A location is never requested automatically. The customer can use GPS, tap/drag on the map,
  choose the map center, or enter coordinates manually. A pin must be explicitly confirmed.
- GPS permission denials, timeouts, stale callbacks and out-of-city points are handled.
- Waze navigation coordinates are included only for the customer's confirmed pin.
- No customer details or location in localStorage, cookies or a server database.
- Map tiles load only after opening the picker. Tiles: OpenStreetMap, with attribution.
  Leaflet 1.9.4 code and styles are hosted locally with its license.
- The generous Baghdad bounding box rejects clearly out-of-city coordinates, not an exact
  service polygon. Restaurant confirmation still determines availability and delivery fees.

`npm test`, `npm run typecheck`, `npm run build` are required before publication.
Browser scripts inspect WhatsApp URLs but never send a real order.
`tests/checkout-enhancements.mjs` covers GPS allowed/denied/delayed/out-of-city, manual pins,
optional address, fixed city, phone formatting, search and responsive checkout.

Production content remains a menu snapshot, not a live Google Sheets connection.
