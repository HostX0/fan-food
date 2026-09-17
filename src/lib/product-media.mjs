/** Local responsive images. Unknown choices fall back to the product, never an external URL. */
export function productImage(product, choice = '') {
  return product.choiceImages && Object.hasOwn(product.choiceImages, choice)
    ? product.choiceImages[choice] : product.image;
}
export function smallImage(image) {
  return image.startsWith('/images/menu-v4/') ? image.replace(/\.webp$/, '-sm.webp') : image;
}
export function productSrcSet(product, choice = '') {
  const image = productImage(product, choice);
  return image.startsWith('/images/menu-v4/') ? `${smallImage(image)} 480w, ${image} 960w` : undefined;
}
