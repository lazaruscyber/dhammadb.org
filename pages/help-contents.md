---
title: Help:Contents
categories: [Help]
---

This page explains how the wiki works and how to add to it. For every piece of special syntax, see the [[Help:Formatting|formatting guide]].

## How the wiki is put together

Everything lives in one folder that you can open, copy or upload anywhere:

| Path | What it is |
|---|---|
| `index.html` | The wiki itself. Open it in any browser. |
| `pages/` | One Markdown (`.md`) file per page. Subfolders are allowed. |
| `pages/_bundle.js` | All pages packed into one file. Made by `build.command`; never edit it by hand. |
| `images/` | Pictures used by pages. |
| `config.js` | Site name, tagline, logo, main page and footer. |
| `build.command` | Rebuilds `pages/_bundle.js` after you change pages. |
| `assets/` | The wiki's engine, styles and logo. |

:::important Why there is a build step
Browsers do not let a page opened straight from your disk read other files, so `index.html` cannot load the `.md` files directly. `build.command` packs them into `pages/_bundle.js`, which the browser *is* allowed to load. No server and no internet connection are needed.
:::

## Adding or editing a page

1. Create a file in `pages/`, for example `pages/dukkha.md`.
2. Start it with a header giving the title and categories:
   ```
   ---
   title: Dukkha
   categories: [Core teachings]
   ---
   ```
3. Write the article in Markdown below the header.
4. Double-click `build.command` (on a Mac). It opens Terminal, rebuilds the bundle and says how many pages it packed.
5. Reload the wiki in your browser.

The file name does not matter to readers; the `title` is what links point to. If you leave out `title`, the file name is used, with dashes turned into spaces.

:::tip First time on a Mac
If macOS will not open `build.command`, right-click it and choose **Open**, or run `bash build.command` in Terminal from the site folder.
:::

## Page header options

| Option | Example | Effect |
|---|---|---|
| `title` | `title: Four Noble Truths` | The page's name, used by links and shown at the top. |
| `categories` | `categories: [Texts, Suttas]` | Lists the page in those categories. |
| `summary` | `summary: A short description.` | Used in search suggestions and link previews. Otherwise the first paragraph is used. |
| `image` | `image: wheel.jpg` | Picture for search suggestions and previews. Otherwise the first infobox image is used. |
| `redirect` | `redirect: Noble Eightfold Path` | Sends readers to another page. |
| `toc` | `toc: false` | Hides the contents list. Use `toc: true` to force it on short pages. |
| `displaytitle` | `displaytitle: *Dhammapada*` | Shows a formatted title instead of the plain one. |
| `updated` | `updated: 2026-11-18` | Overrides the "last edited" date taken from the file. |
| `ai` | `ai: false` | Hides the "Contains AI-generated content" label. Articles show it unless this is set. |

## Special pages

- [[Special:AllPages]] lists every page.
- [[Special:Categories]] lists every category.
- [[Special:RecentChanges]] lists pages by when their file was last saved.
- [[Special:Random]] opens a random article.
- Every page has **What links here** and **View source** in the sidebar.

Press {{kbd|/}} anywhere to jump to the search box.

## Putting it online

The folder is a complete static website. Upload the whole folder (including `pages/_bundle.js`) to any static host and it will work as it does on your computer.
