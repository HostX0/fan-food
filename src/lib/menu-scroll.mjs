/** Default browsing is a single long page; only deliberate search/sort/favorites are filtered views. */
export function isContinuousMenu({category, query = '', sort = 'default'}) {
    return category !== 'favorites' && !query.trim() && sort === 'default';
}
/** Choose the last heading that has reached the reading line below the sticky controls.
 * Tall sections remain active until the next heading crosses this line, in both scroll directions.
 */
export function activeMenuSection(sections, readingLine) {
    const valid = sections.filter(section => typeof section.id === 'string' && Number.isFinite(section.top));
    if (!valid.length) return null;
    let active = valid[0].id;
    for (const section of valid) {
        if (section.top > readingLine) break;
        active = section.id;
    }
    return active;
}
