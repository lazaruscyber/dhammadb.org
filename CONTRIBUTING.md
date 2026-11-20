# Contributing to DhammaDB

Thank you for helping to build DhammaDB. This guide shows you how to create a new page or edit an existing one entirely on the GitHub website, then send it for review. You do not need to install anything.

## Contents

- [How contributions work](#how-contributions-work)
- [Before you start](#before-you-start)
- [Creating a new page](#creating-a-new-page)
- [Editing an existing page](#editing-an-existing-page)
- [Adding images](#adding-images)
- [After you submit](#after-you-submit)
- [Writing guidelines](#writing-guidelines)
- [Files you should not change](#files-you-should-not-change)
- [Previewing on your own computer (optional)](#previewing-on-your-own-computer-optional)
- [Checklist](#checklist)

## How contributions work

Every change goes through a **pull request**: a proposal that maintainers read, discuss with you if needed, and then accept or decline. Nothing you do appears on the live site until a maintainer accepts it, so you cannot break anything by trying.

In short:

1. You create or edit a Markdown file in the `pages` folder.
2. GitHub saves your change on a separate copy (your **fork**) or a separate **branch**.
3. You open a pull request describing the change.
4. A maintainer reviews it, may ask for changes, and merges it when it is ready.
5. The maintainer rebuilds the site, and your change goes live.

## Before you start

- **Create a free GitHub account** at [github.com](https://github.com) and sign in.
- **Check whether the page already exists.** Search the wiki, and look through the `pages` folder in this repository. If it exists, edit it instead of making a new one.
- **Read the formatting guide.** The wiki's **Help:Formatting** page shows every element (infoboxes, references, navigation boxes and so on) with examples. You can also read its source in [`pages/help-formatting.md`](pages/help-formatting.md).

## Creating a new page

### 1. Open the pages folder

On the repository's main page, click the **`pages`** folder.

### 2. Create the file

Click **Add file** (top right of the file list), then **Create new file**.

If you are not a member of the project, GitHub tells you it will create a **fork** (your own copy of the project) to hold your change. This is expected; continue.

### 3. Name the file

In the name box at the top, type the file name. It must:

- end in **`.md`**
- be lower case, with words separated by dashes
- leave out diacritics and special characters

| Page title | File name |
|---|---|
| Dukkha | `dukkha.md` |
| Noble Eightfold Path | `noble-eightfold-path.md` |
| Paṭicca-samuppāda | `paticca-samuppada.md` |
| Category:Suttas | `category-suttas.md` |

The file name is only for the repository. Readers see the `title` from the header, with its diacritics.

### 4. Write the page

Paste this template into the editor and fill it in:

```markdown
---
title: Page title with correct diacritics
categories: [Category one, Category two]
summary: One or two sentences describing the subject, used in search and link previews.
---

:::infobox Page title
Pāli: {{term|pāli term}}
Related: [[Another page]]
:::

The **page title** ({{lang|Pāli|pāli term}}) is ... Open with a clear definition in one or two sentences.[^ref1]

## First section

Text of the section, linking to [[Other pages]] where helpful.

## Second section

More text.{{ref|A source written inline, for example: Majjhima Nikāya 44.}}

[^ref1]: Saṃyutta Nikāya 56.11, *Dhammacakkappavattana Sutta*.
```

Tips:

- The header between the two `---` lines must be the very first thing in the file.
- Use `##` for main sections and `###` for subsections. Do not use a single `#`; the title is already the top heading.
- Link to other pages with `[[Page title]]`. Links to pages that do not exist yet show in red, which is fine and shows what still needs writing.
- A **References** section is added automatically when you use footnotes.
- Click the **Preview** tab above the editor to check the text. GitHub's preview does not understand the wiki's own elements (such as `:::infobox` or `[[links]]`), so they will look plain there. That is normal.

### 5. Commit and propose the page

1. Click **Commit changes...** (or **Propose changes**).
2. Write a short message, for example `Add page: Dukkha`.
3. In the extended description, mention your main sources.
4. If you are a project member, choose **Create a new branch for this commit and start a pull request**. Do not commit directly to `main`.
5. Click **Propose changes** (or **Commit changes**).

### 6. Open the pull request

GitHub shows a **Comparing changes** page.

1. Click **Create pull request**.
2. Give it a clear title, such as `New page: Dukkha`.
3. In the description, explain what the page covers, list your sources, and say whether any of the text was written with AI tools.
4. Click **Create pull request**.

Your page is now waiting for review.

## Editing an existing page

### 1. Find the file

Open the `pages` folder and click the file you want to change. If you only know the page's title, use the search box at the top of the repository, or press `t` on the repository page and type part of the name.

You can also open the page in the wiki and click **Source**; the top of that view shows the file name.

### 2. Open the editor

Click the **pencil icon** (Edit this file) at the top right of the file. If you are not a project member, GitHub creates a fork for you, as above.

### 3. Make your changes

- Change only what is needed. Small, focused edits are reviewed faster.
- Keep the header at the top of the file intact.
- If you correct a fact, add or update the reference that supports it.
- Do not change the `title` unless the page really needs renaming; other pages link to it by title. If it must change, mention this in your pull request so links can be updated.

### 4. Commit and open a pull request

Follow steps 5 and 6 of [Creating a new page](#5-commit-and-propose-the-page), with a message such as `Fix date of the Sixth Council on Tipiṭaka`. In the pull request description, say what you changed and why, and give your source.

### Editing several files at once

To change several files in one pull request, press `.` (full stop) on the repository page. This opens GitHub's web editor, where you can edit multiple files and then commit them together from the **Source Control** panel on the left.

## Adding images

1. Open the **`images`** folder.
2. Click **Add file**, then **Upload files**, and drag your image in.
3. Use a short lower-case file name with dashes, such as `deer-park-sarnath.jpg`.
4. Commit it to the same branch as your page if you can, or mention the image in your pull request.

Use the bare file name in your page:

```markdown
:::figure right 240
deer-park-sarnath.jpg
The Deer Park at Sarnath, where the first discourse was given.
:::
```

Only upload images you have the right to share, and say where each image came from in your pull request. Keep files reasonably small: under 500 KB is a good target.

## After you submit

- A maintainer will review your pull request. They may comment, suggest wording, or ask for a source.
- To respond to feedback, open your pull request, go to **Files changed**, and edit the file again from there (the **...** menu, then **Edit file**). New commits are added to the same pull request automatically.
- When the change is approved, a maintainer merges it, rebuilds `pages/_bundle.js` and publishes the site.
- The page's **Page ID** (shown at the bottom of every page) changes whenever its content changes. That is expected. Its peer-review score then starts again, so readers can confirm the new version.

## Writing guidelines

**Doctrine.** Articles present the orthodox Theravāda position as found in the Pāli Tipiṭaka and its commentaries. Where other views are mentioned, they are clearly identified as such.

**Sources.** Support statements with references a reader can check: give the collection and number for suttas (for example *Saṃyutta Nikāya 56.11*) and full details for books. Never invent a quotation or a reference.

**Pāli.** Use correct diacritics (ā, ī, ū, ṃ, ṅ, ñ, ṭ, ḍ, ṇ, ḷ). Mark Pāli terms with `{{term|...}}` or `{{lang|Pāli|...}}`.

**Tone.** Write plainly and neutrally, for a reader new to the subject. Define terms the first time they appear.

**AI-generated content.** If any part of your contribution was written, summarised or translated with an AI tool, say so in your pull request, and check every statement and reference against the original sources yourself. Articles show the "Contains AI-generated content" label by default. Only maintainers may add `ai: false` to an article's header. See the AI Policy ([`pages/help-ai-policy.md`](pages/help-ai-policy.md)).

## Files you should not change

Pull requests that change these files without discussing it first will usually be declined:

| File or folder | Why |
|---|---|
| `pages/_bundle.js` | Generated by `build.command`; maintainers rebuild it after merging. |
| `assets/` | The wiki engine, styles and logo. |
| `index.html`, `config.js` | Site structure and settings. |
| `functions/` | The peer-review storage that runs on Cloudflare. |
| `build.command` | The build script. |

If you think one of these needs changing, open an **issue** explaining the problem instead.

## Previewing on your own computer (optional)

To see exactly how your page will look before submitting:

1. Clone your fork with [GitHub Desktop](https://desktop.github.com) (**File**, then **Clone repository**).
2. Add or edit your file in the `pages` folder.
3. Run the build: double-click `build.command` on macOS, or run `bash build.command` in a terminal.
4. Open `index.html` in your browser and find your page.
5. Commit your page in GitHub Desktop and click **Push origin**, then **Create Pull Request**.

When committing, leave out `pages/_bundle.js` (untick it in GitHub Desktop) unless a maintainer asks for it. This avoids conflicts with other people's pull requests.

## Checklist

Before opening your pull request, check that:

- [ ] the file is in the `pages` folder, ends in `.md` and has a lower-case, dash-separated name
- [ ] the header has a `title` and at least one category
- [ ] the page opens with a clear one or two sentence definition
- [ ] statements are supported by references
- [ ] Pāli terms have correct diacritics
- [ ] any use of AI is mentioned in the pull request
- [ ] only page files (and images, if needed) are changed

Thank you for your contribution.
