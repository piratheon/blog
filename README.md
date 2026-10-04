# Field Notes // Blog

Notes on systems programming, ethical security research, and self-hosted agentic AI.

Thanks to [Younes](https://github.com/pirateInNet) for the idea.

## How it works

Posts live in `content/` as plain files. `scripts/build.mjs` compiles them to a
static `dist/` using [marked](https://github.com/markedjs/marked) for Markdown and
[gray-matter](https://github.com/jlmkaufman/gray-matter) for metadata. There is no
database and no client-side framework.

**Post shapes**

| Layout | Use for |
| --- | --- |
| `content/<slug>.md` | Almost everything |
| `content/<slug>/index.md` | Posts with images or other files alongside them |
| `content/<slug>.html` + `<slug>.json` | Hand-written HTML the build passes through untouched |

**Frontmatter** (Markdown posts)

```yaml
---
title: "Post title"
date: "2026-08-20"
tags: ["security", "qemu"]
excerpt: "Shown on the index. Generated from the body if omitted."
draft: false
---
```

The build also emits `dist/search-index.json`, which the client fetches to filter
posts as you type.

**Deploy** — pushing to `main` runs `.github/workflows/deploy.yml`, which installs
dependencies, runs the build, and publishes `dist/` to GitHub Pages. Links inside
generated pages are relative, so the site works at any base path.

```bash
npm install
npm run build     # compile content/ to dist/
npm run serve     # build, then serve dist/ locally
```

## License:

This work is licensed under:
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License][cc-by-nc-sa].

[![CC BY-NC-SA 4.0][cc-by-nc-sa-image]][cc-by-nc-sa]

[cc-by-nc-sa]: http://creativecommons.org/licenses/by-nc-sa/4.0/
[cc-by-nc-sa-image]: https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png
[cc-by-nc-sa-shield]: https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg
