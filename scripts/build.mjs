#!/usr/bin/env node
// Compiles everything in content/ into a fully static dist/ directory:
//   - Markdown posts (with YAML frontmatter) -> HTML
//   - Raw HTML posts + a sidecar .json metadata file -> HTML
//   - A generated index page with inline post cards
//   - A generated search-index.json consumed client-side by assets/search.js
//
// Supported content shapes (one level under content/):
//   content/my-post.md                 (frontmatter in the file)
//   content/my-post.html + my-post.json (metadata lives in the JSON file)
//   content/my-post/index.md            (+ any images alongside)
//   content/my-post/index.html + meta.json (+ any images alongside)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';
import { head, header, footer, escapeHtml } from './partials.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIST_DIR = path.join(ROOT, 'dist');

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

marked.setOptions({ gfm: true, breaks: false });

function fail(msg) {
  console.error(`\u2717 ${msg}`);
  process.exitCode = 1;
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeExcerpt(plainText, len = 180) {
  if (plainText.length <= len) return plainText;
  return `${plainText.slice(0, len).replace(/\s+\S*$/, '')}\u2026`;
}

function readJsonIfExists(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in ${path.relative(ROOT, p)}: ${err.message}`);
    return null;
  }
}

function validateMeta(meta, slug) {
  const errors = [];
  if (!meta.title) errors.push('missing "title"');
  if (!meta.date || Number.isNaN(Date.parse(meta.date))) errors.push('missing/invalid "date" (use YYYY-MM-DD)');
  if (meta.tags && !Array.isArray(meta.tags)) errors.push('"tags" must be an array of strings');
  if (errors.length) {
    fail(`Post "${slug}": ${errors.join(', ')}`);
    return false;
  }
  return true;
}

/** Copy every file in srcDir except the ones already consumed as source/metadata. */
function copySideAssets(srcDir, destDir, exclude) {
  if (!fs.existsSync(srcDir)) return;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copySideAssets(from, to, new Set());
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function collectPosts() {
  const posts = [];
  if (!fs.existsSync(CONTENT_DIR)) {
    fail(`content/ directory not found at ${CONTENT_DIR}`);
    return posts;
  }

  const entries = fs.readdirSync(CONTENT_DIR, { withFileTypes: true });
  const consumedJson = new Set(); // json files used as sidecars, so we don't warn about them

  for (const entry of entries) {
    const full = path.join(CONTENT_DIR, entry.name);

    if (entry.isDirectory()) {
      const slug = entry.name;
      const mdPath = path.join(full, 'index.md');
      const htmlPath = path.join(full, 'index.html');
      const metaJsonPath = path.join(full, 'meta.json');

      let meta, bodyHtml, exclude;
      if (fs.existsSync(mdPath)) {
        const raw = fs.readFileSync(mdPath, 'utf8');
        const { data, content } = matter(raw);
        meta = { ...readJsonIfExists(metaJsonPath), ...data }; // frontmatter wins over meta.json
        bodyHtml = marked.parse(content);
        exclude = new Set(['index.md', 'meta.json']);
      } else if (fs.existsSync(htmlPath)) {
        meta = readJsonIfExists(metaJsonPath);
        if (!meta) {
          fail(`Post "${slug}": content/${slug}/index.html needs a sibling meta.json with title/date`);
          continue;
        }
        bodyHtml = fs.readFileSync(htmlPath, 'utf8');
        exclude = new Set(['index.html', 'meta.json']);
      } else {
        continue; // not a post folder (could be a shared assets folder etc.)
      }

      if (!validateMeta(meta, slug)) continue;
      posts.push({ slug, meta, bodyHtml, assetDir: full, exclude });
      continue;
    }

    if (entry.name.endsWith('.md')) {
      const slug = entry.name.replace(/\.md$/, '');
      const raw = fs.readFileSync(full, 'utf8');
      const { data, content } = matter(raw);
      if (!validateMeta(data, slug)) continue;
      posts.push({ slug, meta: data, bodyHtml: marked.parse(content), assetDir: null, exclude: null });
      continue;
    }

    if (entry.name.endsWith('.html')) {
      const slug = entry.name.replace(/\.html$/, '');
      const jsonPath = path.join(CONTENT_DIR, `${slug}.json`);
      consumedJson.add(`${slug}.json`);
      const meta = readJsonIfExists(jsonPath);
      if (!meta) {
        fail(`Post "${slug}": content/${slug}.html needs a sibling content/${slug}.json with title/date`);
        continue;
      }
      if (!validateMeta(meta, slug)) continue;
      posts.push({ slug, meta, bodyHtml: fs.readFileSync(full, 'utf8'), assetDir: null, exclude: null });
      continue;
    }

    if (entry.name.endsWith('.json')) continue; // sidecar, handled above
    console.warn(`\u26a0 Skipping content/${entry.name} — not a recognized post type (.md, .html+.json, or a folder)`);
  }

  return posts;
}

function renderIndex(posts) {
  const cards = posts
    .map((p) => {
      const tags = (p.meta.tags || [])
        .map((t) => `<li class="tag-pill">${escapeHtml(t)}</li>`)
        .join('');
      return `      <a class="post-card" href="posts/${p.slug}/index.html" data-slug="${p.slug}">
        <div class="container">
          <div class="post-card-inner">
            <time class="post-date" datetime="${p.meta.date}">${formatDate(p.meta.date)}</time>
            <div>
              <h2>${escapeHtml(p.meta.title)}</h2>
              <p class="post-excerpt">${escapeHtml(p.excerpt)}</p>
              ${tags ? `<ul class="tag-list">${tags}</ul>` : ''}
            </div>
          </div>
        </div>
      </a>`;
    })
    .join('\n');

  return `${head({
    title: config.title,
    description: config.description,
    prefix: '',
    config,
  })}${header({ prefix: '', config, activePath: 'index.html' })}
  <main id="main">
    <section class="blog-hero">
      <div class="container">
        <span class="eyebrow">Writing</span>
        <h1 class="page-heading">${escapeHtml(config.title)}</h1>
        <p class="section-intro">${escapeHtml(config.description)}</p>

        <div class="search-wrap">
          <label class="sr-only" for="search-input">Search posts</label>
          <div class="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input id="search-input" type="search" placeholder="Search posts by title, tag, or content\u2026" autocomplete="off" />
          </div>
          <p class="search-meta" id="search-meta">${posts.length} post${posts.length === 1 ? '' : 's'}</p>
        </div>
      </div>
    </section>

    <section class="posts-section">
      <div class="container">
        <div class="post-grid" id="post-grid">
${cards || '          <p class="no-results">No posts yet.</p>'}
        </div>
        <p class="no-results" id="no-results" hidden>No posts match your search.</p>
      </div>
    </section>
  </main>
${footer({ config })}<script src="assets/search.js"></script>
</html>
`;
}

function renderPost(post, posts) {
  const idx = posts.findIndex((p) => p.slug === post.slug);
  const prev = posts[idx + 1]; // older
  const next = posts[idx - 1]; // newer
  const tags = (post.meta.tags || [])
    .map((t) => `<li class="tag-pill">${escapeHtml(t)}</li>`)
    .join('');

  return `${head({
    title: `${post.meta.title} \u2014 ${config.shortTitle}`,
    description: post.excerpt,
    prefix: '../../',
    config,
  })}${header({ prefix: '../../', config })}
  <main id="main">
    <header class="post-header">
      <div class="container-narrow">
        <a class="text-link" href="../../index.html">\u2190 All posts</a>
        <h1>${escapeHtml(post.meta.title)}</h1>
        <div class="post-meta-line">
          <time datetime="${post.meta.date}">${formatDate(post.meta.date)}</time>
          ${tags ? `<span class="dot"></span><ul class="tag-list">${tags}</ul>` : ''}
        </div>
      </div>
    </header>
    <article class="post-body">
      <div class="container-narrow">
        ${post.bodyHtml}
      </div>
    </article>
    <nav class="container-narrow post-footer-nav" aria-label="Post navigation">
      ${prev ? `<a class="text-link" href="../${prev.slug}/index.html">\u2190 ${escapeHtml(prev.meta.title)}</a>` : ''}
      ${next ? `<a class="text-link" href="../${next.slug}/index.html">${escapeHtml(next.meta.title)} \u2192</a>` : ''}
    </nav>
  </main>
${footer({ config })}</html>
`;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function build() {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  fs.mkdirSync(DIST_DIR, { recursive: true });

  let posts = collectPosts();
  posts = posts
    .filter((p) => !p.meta.draft)
    .map((p) => {
      const plainText = stripHtml(p.bodyHtml);
      return {
        ...p,
        excerpt: p.meta.excerpt || makeExcerpt(plainText),
        plainText,
      };
    })
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  if (process.exitCode) {
    console.error('\nBuild aborted due to metadata errors above.');
    process.exit(1);
  }

  // assets
  fs.mkdirSync(path.join(DIST_DIR, 'assets'), { recursive: true });
  for (const file of fs.readdirSync(ASSETS_DIR)) {
    fs.copyFileSync(path.join(ASSETS_DIR, file), path.join(DIST_DIR, 'assets', file));
  }

  // index
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), renderIndex(posts));

  // search index
  const searchIndex = posts.map((p) => ({
    slug: p.slug,
    title: p.meta.title,
    date: p.meta.date,
    excerpt: p.excerpt,
    tags: p.meta.tags || [],
    text: p.plainText.slice(0, 4000),
  }));
  fs.writeFileSync(path.join(DIST_DIR, 'search-index.json'), JSON.stringify(searchIndex));

  // posts
  for (const post of posts) {
    const outDir = path.join(DIST_DIR, 'posts', post.slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPost(post, posts));
    if (post.assetDir) copySideAssets(post.assetDir, outDir, post.exclude);
  }

  console.log(`\u2713 Built ${posts.length} post${posts.length === 1 ? '' : 's'} to dist/`);
}

build();
