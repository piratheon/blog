// Small HTML-fragment helpers shared by index and post pages.
// No templating engine on purpose — the build has exactly two page shapes,
// a tiny template library would be more code than it saves.

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** `prefix` is the relative path back to the site root ('' at root, '../../' from posts/<slug>/). */
export function head({ title, description, prefix, config, canonicalPath }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="icon" href="${config.icon}" type="image/svg+xml">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#0a0e0c" />
  <title>${escapeHtml(title)}</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Public+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${prefix}assets/style.css" />
</head>
<body>
<a href="#main" class="sr-only">Skip to main content</a>
`;
}

export function header({ prefix, config, activePath }) {
  const navItems = [{ label: config.shortTitle || 'Blog', href: `${prefix}index.html` }, ...config.nav];
  const links = navItems
    .map((item) => {
      const isActive = activePath && item.href === activePath;
      return `<li><a href="${item.href}"${isActive ? ' class="is-active" aria-current="page"' : ''}>${escapeHtml(item.label)}</a></li>`;
    })
    .join('\n      ');

  return `  <header class="site-header">
    <div class="container header-inner">
      <a href="${prefix}index.html" class="wordmark" aria-label="${escapeHtml(config.author)} — blog home">
        <img src="${config.icon}" alt="" width="20" height="20" />
        <span>PIRΛTHΞΘN <span class="tag">/ blog</span></span>
      </a>
      <nav class="site-nav" aria-label="Primary">
        <ul>
      ${links}
        </ul>
      </nav>
    </div>
  </header>
`;
}

export function footer({ config }) {
  return `  <footer class="site-footer">
    <div class="container">
      <p>&copy; <span id="year"></span> ${escapeHtml(config.author)}.</p>
      <p><a class="text-link" href="${config.portfolioUrl}">Back to portfolio</a></p>
    </div>
  </footer>
  <script>document.getElementById('year').textContent = new Date().getFullYear();</script>
</body>
</html>
`;
}
