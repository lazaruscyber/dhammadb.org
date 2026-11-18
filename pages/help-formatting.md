---
title: Help:Formatting
categories: [Help]
---

Pages are written in standard Markdown, plus a few additions that a wiki needs. Each section below shows the syntax and then the result.

## Ordinary Markdown

```
**bold**, *italic*, `code`, [a website](https://example.org)

- bullet list
1. numbered list

> a block quotation

| Column | Column |
|---|---|
| cell | cell |
```

Headings made with `##` and `###` appear in the contents list automatically. Use `##` for main sections; the page title is already the top heading. Tables become sortable when they have three or more rows.

## Links between pages

```
[[Four Noble Truths]]
[[Four Noble Truths|the truths]]
[[Four Noble Truths#Cessation]]
[[:Category:Core teachings|]]
[[Tipiṭaka]]s
[[A page that does not exist]]
```

Result: [[Four Noble Truths]], [[Four Noble Truths|the truths]], [[Four Noble Truths#Cessation]], [[:Category:Core teachings|]], [[Tipiṭaka]]s, [[A page that does not exist]].

- Text after `|` is shown instead of the title.
- `#Section` links to a heading on that page.
- An empty `|` hides the prefix, so `[[:Category:Core teachings|]]` shows just "Core teachings".
- Letters straight after the link become part of it.
- Links to missing pages are shown in red. Clicking one explains how to create the page.

## Categories

Add categories in the page header with `categories: [Texts, Suttas]`, or anywhere in the text with `[[Category:Texts]]` (this shows nothing where you write it). To *link* to a category instead, start with a colon: `[[:Category:Texts]]`.

A category page lists its pages automatically. To add a description, create a page titled `Category:Texts`.

## Infobox

The summary box on the right of an article. Each line is `Label: value`. A line starting with `##` makes a heading row, and `image:` with an optional `caption:` adds a picture. A bare file name like `wheel.jpg` is looked for in the `images` folder.

```
:::infobox Four Noble Truths
image: dhammacakka.svg
caption: The Dhamma wheel
Pāli: {{term|cattāri ariyasaccāni}}
First taught: [[Dhammacakkappavattana Sutta]]
## Related
Path: [[Noble Eightfold Path]]
:::
```

:::infobox Four Noble Truths
image: dhammacakka.svg
caption: The Dhamma wheel
Pāli: {{term|cattāri ariyasaccāni}}
First taught: [[Dhammacakkappavattana Sutta]]
## Related
Path: [[Noble Eightfold Path]]
:::

Put the infobox near the top of the page, before the first paragraph, so the text flows around it.

{{clear}}

## References

Use numbered footnotes, or write the reference inline with `{{ref|...}}`. A **References** section is added at the end of the page automatically (before any navigation box). To place it yourself, write `{{reflist}}` on its own line.

```
Craving is the origin of suffering.[^sn5611]
The first disciple was Koṇḍañña.{{ref|Vinaya, Mahāvagga 1.}}
This needs a source.{{cn}}

[^sn5611]: Saṃyutta Nikāya 56.11.
```

Result: Craving is the origin of suffering.[^sn5611] The first disciple was Koṇḍañña.{{ref|Vinaya, Mahāvagga 1.}} This needs a source.{{cn}}

[^sn5611]: Saṃyutta Nikāya 56.11.

{{reflist}}

Using the same footnote name twice reuses its number.

## Hatnotes

Short italic notes at the top of an article or section, pointing readers elsewhere.

```
{{main|Dukkha}}
{{see also|Sīla|Samādhi|Paññā}}
{{further|Tipiṭaka}}

:::hatnote
For the discourse, see [[Dhammacakkappavattana Sutta]].
:::
```

{{main|Dukkha}}
{{see also|Sīla|Samādhi|Paññā}}
{{further|Tipiṭaka}}

:::hatnote
For the discourse, see [[Dhammacakkappavattana Sutta]].
:::

## Callouts and notices

```
:::note
A neutral note.
:::

:::tip Study tip
A helpful suggestion, with a custom title.
:::

:::warning
Something to be careful about.
:::

:::important
Something readers must not miss.
:::

:::notice
A banner for the top of a page, such as "This article is incomplete."
:::
```

:::note
A neutral note.
:::

:::tip Study tip
A helpful suggestion, with a custom title.
:::

:::warning
Something to be careful about.
:::

:::important
Something readers must not miss.
:::

:::notice
A banner for the top of a page, such as "This article is incomplete."
:::

## Quotations

```
:::quote Dhammapada, verse 1
Mind precedes all things; mind is their chief; they are mind-made.
:::
```

:::quote Dhammapada, verse 1
Mind precedes all things; mind is their chief; they are mind-made.
:::

## Pictures

A framed picture with a caption. Give `left`, `right`, `center` or `none`, and optionally a width.

```
:::figure right 180
dhammacakka.svg
The Dhamma wheel, with eight spokes for the [[Noble Eightfold Path]].
:::
```

:::figure right 180
dhammacakka.svg
The Dhamma wheel, with eight spokes for the [[Noble Eightfold Path]].
:::

A gallery shows several pictures in a grid, one per line as `file | caption`:

```
:::gallery Symbols
dhammacakka.svg | The Dhamma wheel
dhammacakka.svg | Another copy
:::
```

:::gallery Symbols
dhammacakka.svg | The Dhamma wheel
dhammacakka.svg | Another copy
:::

Ordinary Markdown images also work: `![alt text](dhammacakka.svg)`.

## Navigation box

A box at the foot of related articles. Each line is `Group: item | item | item` (spaces around the `|` matter).

```
:::navbox Core teachings
Truths: [[Four Noble Truths]] | [[Dukkha]] | [[Nibbāna]]
Texts: [[Tipiṭaka]] | [[Dhammacakkappavattana Sutta]]
:::
```

:::navbox Core teachings
Truths: [[Four Noble Truths]] | [[Dukkha]] | [[Nibbāna]]
Texts: [[Tipiṭaka]] | [[Dhammacakkappavattana Sutta]]
:::

## Layout blocks

```
:::columns 3
- one
- two
- three
- four
- five
- six
:::

:::collapse Show the Pāli
Pāli text that starts hidden.
:::

:::aside Quick facts
A small box floated to the right.
:::
```

:::columns 3
- one
- two
- three
- four
- five
- six
:::

:::collapse Show the Pāli
Pāli text that starts hidden.
:::

`:::grid 2` with `:::box Title` blocks inside it builds panels like the ones on the [[Main Page]]. Blocks can be nested: close each one with its own `:::` line.

## Inline templates

| Write | Result | Use |
|---|---|---|
| `{{lang|Pāli|dhamma}}` | {{lang|Pāli|dhamma}} | Name a word's language |
| `{{term|dukkha|suffering}}` | {{term|dukkha|suffering}} | A foreign term with a gloss |
| `{{abbr|SN|Saṃyutta Nikāya}}` | {{abbr|SN|Saṃyutta Nikāya}} | Abbreviation with a hover title |
| `{{small|text}}` | {{small|text}} | Smaller text |
| `{{mark|text}}` | {{mark|text}} | Highlighted text |
| `{{badge|New}}` | {{badge|New}} | A small label |
| `{{kbd|Ctrl}}` | {{kbd|Ctrl}} | A key |
| `{{nowrap|SN 56.11}}` | {{nowrap|SN 56.11}} | Keep text on one line |
| `{{cn}}` | {{cn}} | Citation needed |
| `{{pagecount}}` | {{pagecount}} | Number of articles |
| `{{sitename}}` | {{sitename}} | The site name from `config.js` |

## Lists of pages

These go on a line of their own:

```
{{pages in|Core teachings}}
{{recent|5}}
```

{{pages in|Core teachings}}

The first lists every page in a category; the second lists the most recently edited pages.

## Redirects

A page whose header contains `redirect: Other title` and nothing else sends readers to that page. For example, [[Eightfold Path]] goes to [[Noble Eightfold Path]].
