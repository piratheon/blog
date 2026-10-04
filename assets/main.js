'use strict';
/**
 * Site-wide chrome behaviour, loaded on every page.
 * Mirrors assets/main.js in the companion portfolio repo
 * (https://github.com/piratheon/portfolio) so both headers react to
 * scroll the same way.
 */

// ===== HEADER SCROLL STATE =====
// Flips the hairline under the header from transparent to visible.
const header = document.querySelector('header.site-header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}