/*
 * Static wiki engine.
 * Reads the pages packed into pages/_bundle.js (made by build.command),
 * renders them with marked plus the wiki's own Markdown extensions,
 * and routes between them with the URL hash, so it works from file://.
 */
(function () {
  'use strict';

  var CFG = Object.assign({
    siteName: 'DhammaDB',
    tagline: 'The free Dhamma encyclopedia',
    mainPage: 'Main Page',
    dateLocale: 'en-GB',
    aiPolicyPage: 'ai-policy.html',   // the standalone page the AI label links to
    aiByDefault: true                 // articles show the AI label unless their header says  ai: false
  }, window.WIKI_CONFIG || {});

  var FILES = window.WIKI_FILES || [];

  /* ------------------------------------------------------------------ */
  /* Utilities                                                           */
  /* ------------------------------------------------------------------ */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function normTitle(t) {
    t = String(t || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    // Namespace prefixes keep their own capital, and so does the part after them.
    var m = t.match(/^([^:]+):(.*)$/);
    if (m && /^(category|help|special|about|portal)$/i.test(m[1].trim())) {
      var ns = m[1].trim();
      ns = ns.charAt(0).toUpperCase() + ns.slice(1).toLowerCase();
      var rest = m[2].trim();
      return ns + ':' + (rest.charAt(0).toUpperCase() + rest.slice(1));
    }
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }
  function keyOf(t) { return normTitle(t).toLowerCase(); }
  function hrefFor(title, anchor, query) {
    var s = encodeURIComponent(normTitle(title).replace(/ /g, '_'))
      .replace(/%3A/gi, ':').replace(/%2F/gi, '/');
    return '#/' + s + (query ? '?' + query : '') + (anchor ? '#' + encodeURIComponent(anchor) : '');
  }
  function slugify(s) {
    return String(s).replace(/<[^>]*>/g, '').trim().toLowerCase()
      .replace(/&[a-z#0-9]+;/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-') || 'section';
  }
  function stripTags(s) { var d = document.createElement('div'); d.innerHTML = s; return d.textContent; }
  function imgSrc(src) {
    src = String(src).trim();
    // A bare file name means "look in the images folder".
    if (!/[\/:]/.test(src)) return 'images/' + src;
    return src;
  }
  function fmtDate(sec) {
    if (!sec) return '';
    var d = new Date(sec * 1000);
    return d.toLocaleDateString(CFG.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) +
      ', at ' + d.toLocaleTimeString(CFG.dateLocale, { hour: '2-digit', minute: '2-digit' });
  }
  // Split template / table arguments on "|" while ignoring pipes inside [[ ]] and {{ }}.
  function splitArgs(s, sep) {
    sep = sep || '|';
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var two = s.substr(i, 2);
      if (two === '[[' || two === '{{') { depth++; cur += two; i++; continue; }
      if ((two === ']]' || two === '}}') && depth > 0) { depth--; cur += two; i++; continue; }
      if (depth === 0 && s.substr(i, sep.length) === sep) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += s[i];
    }
    out.push(cur);
    return out;
  }
  // Find "key: value" where the colon is outside brackets and followed by a space.
  function splitKV(line) {
    var depth = 0;
    for (var i = 0; i < line.length; i++) {
      var c = line[i], two = line.substr(i, 2);
      if (two === '[[' || two === '{{') { depth++; i++; continue; }
      if (two === ']]' || two === '}}') { depth = Math.max(0, depth - 1); i++; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      if (depth === 0 && c === ':' && (line[i + 1] === ' ' || line[i + 1] === '\t' || i === line.length - 1) && i > 0) {
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Loading pages                                                       */
  /* ------------------------------------------------------------------ */

  function unquote(v) {
    v = v.trim();
    if ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'")) v = v.slice(1, -1);
    return v;
  }
  function parseFrontMatter(text) {
    var m = text.match(/^﻿?---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
    var meta = {};
    if (!m) return { meta: meta, body: text };
    var lastKey = null;
    m[1].split('\n').forEach(function (line) {
      var item = line.match(/^\s+-\s+(.*)$/) || line.match(/^-\s+(.*)$/);
      if (item && lastKey) {
        if (!Array.isArray(meta[lastKey])) meta[lastKey] = meta[lastKey] ? [meta[lastKey]] : [];
        meta[lastKey].push(unquote(item[1]));
        return;
      }
      var kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (!kv) return;
      var key = kv[1].toLowerCase(), v = kv[2].trim();
      lastKey = key;
      if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map(unquote).filter(Boolean);
      else {
        v = unquote(v);
        if (v === 'true') v = true; else if (v === 'false') v = false;
      }
      meta[key] = v;
    });
    return { meta: meta, body: text.slice(m[0].length) };
  }
  // Remove fenced code blocks and inline code so examples are not treated as real markup.
  function stripCode(s) {
    return s.replace(/^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?^[ \t]*\1[ \t]*$/gm, '').replace(/`[^`\n]*`/g, '');
  }
  function extractLinks(body) {
    body = stripCode(body);
    var out = {};
    body.replace(/\[\[([^\[\]|#]+)/g, function (_, t) {
      t = t.trim();
      if (!t || t[0] === ':' || /^category\s*:/i.test(t)) return;
      out[keyOf(t)] = true;
    });
    return Object.keys(out);
  }

  var PAGES = {};     // key -> page
  var LIST = [];      // all pages
  var CATS = {};      // category title -> [pages]

  FILES.forEach(function (f) {
    var text = String(f.text).replace(/\r\n?/g, '\n');
    var fm = parseFrontMatter(text);
    var meta = fm.meta, body = fm.body;
    var base = f.file.replace(/^.*\//, '').replace(/\.md$/i, '');
    var title = normTitle(meta.title || base.replace(/[-_]+/g, ' '));
    var cats = meta.categories || meta.category || [];
    if (typeof cats === 'string') cats = cats.split(',');
    cats = cats.slice();
    stripCode(body).replace(/\[\[\s*Category\s*:\s*([^\]|]+)(?:\|[^\]]*)?\]\]/gi, function (_, c) { cats.push(c); });
    var seen = {};
    cats = cats.map(function (c) { return normTitle(c); }).filter(function (c) {
      if (!c || seen[c]) return false; seen[c] = true; return true;
    });
    var mtime = f.mtime;
    if (meta.updated && !isNaN(Date.parse(meta.updated))) mtime = Date.parse(meta.updated) / 1000;
    var p = {
      title: title, file: f.file, mtime: mtime, hash: f.hash || '', meta: meta, body: body, raw: text,
      cats: cats, links: extractLinks(body), redirect: meta.redirect ? normTitle(meta.redirect) : null,
      isCategory: /^Category:/.test(title), isHelp: /^Help:/.test(title)
    };
    if (PAGES[keyOf(title)]) console.warn('Two files share the title "' + title + '":', PAGES[keyOf(title)].file, f.file);
    PAGES[keyOf(title)] = p;
    LIST.push(p);
  });
  LIST.forEach(function (p) {
    if (p.redirect) return;
    p.cats.forEach(function (c) { (CATS[c] = CATS[c] || []).push(p); });
  });
  LIST.sort(function (a, b) { return a.title.localeCompare(b.title); });

  function getPage(title) { return PAGES[keyOf(title)] || null; }
  function articles() {
    return LIST.filter(function (p) { return !p.redirect && !p.isCategory && !p.isHelp && keyOf(p.title) !== keyOf(CFG.mainPage); });
  }
  var SPECIALS = ['AllPages', 'Categories', 'Random', 'Search', 'RecentChanges', 'WhatLinksHere'];
  function specialExists(t) {
    var m = normTitle(t).match(/^Special:([^\/]+)/);
    return !!(m && SPECIALS.some(function (s) { return s.toLowerCase() === m[1].toLowerCase(); }));
  }
  function titleExists(t) {
    t = normTitle(t);
    if (getPage(t) || specialExists(t)) return true;
    var c = t.match(/^Category:(.+)$/);
    return !!(c && CATS[normTitle(c[1])]);
  }

  /* ------------------------------------------------------------------ */
  /* Markdown with wiki extensions                                       */
  /* ------------------------------------------------------------------ */

  var R = null; // render state for the page being rendered

  function newState(title) {
    return { title: title, headings: [], ids: {}, refs: [], refByName: {}, defs: {} };
  }
  function uniqueId(base) {
    var id = base, n = 2;
    while (R.ids[id]) id = base + '-' + (n++);
    R.ids[id] = true;
    return id;
  }

  var md = new marked.Marked({ gfm: true, breaks: false });
  function inl(s) { return md.parseInline(String(s)); }

  // [[Target]], [[Target|label]], [[Target#Section]], [[:Category:X]], [[Category:X]] (hidden)
  function renderWikiLink(inner, trail) {
    var parts = splitArgs(inner);
    var target = parts[0].trim();
    var label = parts.length > 1 ? parts.slice(1).join('|') : null;
    if (/^category\s*:/i.test(target)) return '';            // categorises the page
    if (target[0] === ':') target = target.slice(1);
    var anchor = '';
    var hi = target.indexOf('#');
    if (hi >= 0) { anchor = target.slice(hi + 1).trim(); target = target.slice(0, hi).trim(); }
    var shown;
    if (label === '') shown = esc(target.replace(/^[^:]+:/, '').replace(/\s*\([^)]*\)$/, ''));
    else if (label != null) shown = inl(label);
    else shown = esc(target ? (anchor ? target + ' § ' + anchor : target) : '§ ' + anchor);
    if (!target) target = R ? R.title : CFG.mainPage;
    var exists = titleExists(target);
    var t = normTitle(target);
    return '<a href="' + hrefFor(t, anchor ? slugify(anchor) : '') + '" class="wl' + (exists ? '' : ' new') +
      '" data-title="' + esc(t) + '" title="' + esc(exists ? t : t + ' (page does not exist)') + '">' +
      shown + esc(trail || '') + '</a>';
  }

  function joinList(items) {
    if (items.length < 2) return items.join('');
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  function linkList(args) {
    return joinList(args.map(function (a) { return renderWikiLink(a.trim(), ''); }));
  }

  function addRef(name, text) {
    var ref;
    if (name && R.refByName[name]) ref = R.refByName[name];
    else {
      var src = text != null ? text : (name && R.defs[name] != null ? R.defs[name] : null);
      ref = { n: R.refs.length + 1, html: src == null ? '<span class="error">Reference "' + esc(name) + '" is used but not defined.</span>' : inl(src), uses: 0 };
      R.refs.push(ref);
      if (name) R.refByName[name] = ref;
    }
    ref.uses++;
    var useId = 'cite-ref-' + ref.n + '-' + ref.uses;
    return '<sup class="ref" id="' + useId + '"><a href="' + hrefFor(R.title, 'cite-note-' + ref.n) + '">[' + ref.n + ']</a></sup>';
  }
  function reflistHtml() {
    if (!R.refs.length) return '';
    var letters = 'abcdefghijklmnopqrstuvwxyz';
    return '<ol class="references">' + R.refs.map(function (r) {
      var back;
      if (r.uses === 1) back = '<a class="ref-back" href="' + hrefFor(R.title, 'cite-ref-' + r.n + '-1') + '" aria-label="Back to text">↑</a>';
      else {
        back = '<span class="ref-back">↑ ';
        for (var i = 1; i <= r.uses; i++) back += '<a href="' + hrefFor(R.title, 'cite-ref-' + r.n + '-' + i) + '">' + letters[(i - 1) % 26] + '</a> ';
        back += '</span>';
      }
      return '<li id="cite-note-' + r.n + '">' + back + ' <span class="ref-text">' + r.html + '</span></li>';
    }).join('') + '</ol>';
  }

  // Inline templates: {{name|arg|arg}}
  function renderTemplate(inner) {
    var args = splitArgs(inner);
    var name = args.shift().trim().toLowerCase();
    var a = function (i) { return args[i] != null ? args[i].trim() : ''; };
    switch (name) {
      case 'ref': return addRef(null, args.join('|'));
      case 'lang': return '<span class="lang-tag">' + esc(a(0)) + ':</span> <i class="foreign">' + inl(a(1)) + '</i>';
      case 'term': return '<i class="foreign">' + inl(a(0)) + '</i>' + (a(1) ? ' <span class="gloss">(' + inl(a(1)) + ')</span>' : '');
      case 'small': return '<small>' + inl(args.join('|')) + '</small>';
      case 'nowrap': return '<span class="nowrap">' + inl(args.join('|')) + '</span>';
      case 'abbr': return '<abbr title="' + esc(a(1)) + '">' + esc(a(0)) + '</abbr>';
      case 'kbd': return '<kbd>' + esc(a(0)) + '</kbd>';
      case 'mark': case 'highlight': return '<mark>' + inl(args.join('|')) + '</mark>';
      case 'sup': return '<sup>' + inl(a(0)) + '</sup>';
      case 'sub': return '<sub>' + inl(a(0)) + '</sub>';
      case 'cn': case 'citation needed': return '<sup class="cn">[<a href="' + hrefFor('Help:Formatting', 'references') + '">citation needed</a>]</sup>';
      case 'pagecount': return String(articles().length);
      case 'sitename': return esc(CFG.siteName);
      case 'main': return '<span class="hatnote-inline">Main article: ' + linkList(args) + '</span>';
      case 'see also': return '<span class="hatnote-inline">See also: ' + linkList(args) + '</span>';
      case 'badge': return '<span class="badge">' + inl(args.join('|')) + '</span>';
      default: return '<span class="tpl-missing" title="Unknown template">{{' + esc(inner) + '}}</span>';
    }
  }

  // Block templates that stand alone on a line.
  function renderBlockTemplate(inner) {
    var args = splitArgs(inner);
    var name = args.shift().trim().toLowerCase();
    switch (name) {
      case 'main': return '<div class="hatnote">' + (args.length > 1 ? 'Main articles: ' : 'Main article: ') + linkList(args) + '</div>';
      case 'see also': return '<div class="hatnote">See also: ' + linkList(args) + '</div>';
      case 'further': return '<div class="hatnote">Further information: ' + linkList(args) + '</div>';
      case 'reflist': case 'references': return '<!--REFLIST-->';
      case 'clear': return '<div class="clear"></div>';
      case 'category list': case 'pages in': {
        var cat = normTitle(args[0] || '');
        var pages = (CATS[cat] || []).slice().sort(function (x, y) { return x.title.localeCompare(y.title); });
        if (!pages.length) return '<p class="muted">No pages in ' + esc(cat) + ' yet.</p>';
        return '<ul class="page-list">' + pages.map(function (p) { return '<li>' + renderWikiLink(':' + p.title, '') + '</li>'; }).join('') + '</ul>';
      }
      case 'recent changes': case 'recent': {
        var n = parseInt(args[0], 10) || 5;
        var rec = LIST.filter(function (p) { return !p.redirect; }).sort(function (x, y) { return (y.mtime || 0) - (x.mtime || 0); }).slice(0, n);
        return '<ul class="page-list">' + rec.map(function (p) { return '<li>' + renderWikiLink(':' + p.title, '') + '</li>'; }).join('') + '</ul>';
      }
      default: return null;
    }
  }

  function renderInfobox(title, text) {
    var rows = [];
    var lastImg = null;
    text.split('\n').forEach(function (line) {
      var t = line.trim(), m, kv;
      if (!t) return;
      if ((m = t.match(/^#{1,6}\s+(.*)$/))) rows.push({ html: '<tr><th colspan="2" class="ib-header">' + inl(m[1]) + '</th></tr>' });
      else if ((m = t.match(/^image\s*:\s*(.+)$/i))) {
        lastImg = { src: imgSrc(m[1]), caption: '' };
        rows.push(lastImg);
      }
      else if ((m = t.match(/^caption\s*:\s*(.+)$/i)) && lastImg) lastImg.caption = m[1];
      else if ((kv = splitKV(t))) rows.push({ html: '<tr><th scope="row">' + inl(kv[0]) + '</th><td>' + inl(kv[1]) + '</td></tr>' });
      else rows.push({ html: '<tr><td colspan="2" class="ib-full">' + inl(t) + '</td></tr>' });
    });
    return '<aside class="infobox"><table>' +
      (title ? '<caption class="ib-title">' + inl(title) + '</caption>' : '') +
      '<tbody>' + rows.map(function (r) {
        if (r.html) return r.html;
        return '<tr><td colspan="2" class="ib-image"><img src="' + esc(r.src) + '" alt="' + esc(stripTags(inl(r.caption || title || ''))) + '" loading="lazy">' +
          (r.caption ? '<div class="ib-caption">' + inl(r.caption) + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></aside>';
  }

  function renderNavbox(title, text) {
    var rows = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      var kv = splitKV(line), group = null, list = line;
      if (kv) { group = kv[0]; list = kv[1]; }
      var items = splitArgs(list, ' | ').map(function (s) { return s.trim(); }).filter(Boolean);
      return '<div class="nb-row">' + (group ? '<div class="nb-group">' + inl(group) + '</div>' : '') +
        '<ul class="nb-list' + (group ? '' : ' nb-wide') + '">' + items.map(function (i) { return '<li>' + inl(i) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
    return '<details class="navbox" open><summary>' + inl(title || 'Related') + '</summary><div class="nb-body">' + rows + '</div></details>';
  }

  function renderGallery(args, text) {
    var items = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (line) {
      var parts = splitArgs(line);
      var src = imgSrc(parts[0]), cap = parts.slice(1).join('|').trim();
      return '<figure class="g-item"><a class="g-img" href="' + esc(src) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + esc(stripTags(inl(cap))) + '" loading="lazy"></a>' +
        (cap ? '<figcaption>' + inl(cap) + '</figcaption>' : '') + '</figure>';
    }).join('');
    return '<div class="gallery">' + (args ? '<div class="g-title">' + inl(args) + '</div>' : '') + '<div class="g-grid">' + items + '</div></div>';
  }

  function renderFigure(args, text) {
    var a = args.split(/\s+/).filter(Boolean);
    var side = 'right', width = '';
    a.forEach(function (x) {
      if (/^(left|right|center|none)$/i.test(x)) side = x.toLowerCase();
      else if (/^\d+(px|%|em|rem)?$/.test(x)) width = /\d$/.test(x) ? x + 'px' : x;
    });
    var lines = text.split('\n');
    var first = '';
    while (lines.length && !(first = lines.shift().trim())) { /* skip blanks */ }
    var im = first.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/);
    var src = imgSrc(im ? im[2] : first);
    var cap = lines.join('\n').trim();
    return '<figure class="thumb thumb-' + side + '"' + (width ? ' style="width:' + esc(width) + '"' : '') + '>' +
      '<a href="' + esc(src) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + esc(stripTags(inl(cap || (im && im[1]) || ''))) + '" loading="lazy"></a>' +
      (cap ? '<figcaption>' + md.parse(cap) + '</figcaption>' : '') + '</figure>';
  }

  var MARKDOWN_BODY = ['note', 'tip', 'warning', 'important', 'info', 'hatnote', 'quote', 'collapse', 'columns',
    'box', 'grid', 'center', 'aside', 'references', 'notice', 'banner', 'lead', 'div'];

  var containerExt = {
    name: 'container', level: 'block',
    start: function (src) {
      // marked passes the text minus its first character, so only match after a newline.
      var m = src.match(/\n[ \t]*:::[a-zA-Z]/);
      return m ? m.index + 1 : undefined;
    },
    tokenizer: function (src) {
      var open = /^[ \t]*:::([a-zA-Z][\w-]*)[ \t]*([^\n]*)(?:\n|$)/.exec(src);
      if (!open) return;
      var rest = src.slice(open[0].length);
      var lines = rest.split('\n');
      var depth = 1, used = open[0].length, inner = [], closed = false, fence = false;
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i], t = L.trim();
        if (/^(```|~~~)/.test(t)) fence = !fence;
        if (!fence) {
          if (/^:::[a-zA-Z]/.test(t)) depth++;
          else if (t === ':::') {
            depth--;
            if (depth === 0) { used += L.length + (i < lines.length - 1 ? 1 : 0); closed = true; break; }
          }
        }
        inner.push(L);
        used += L.length + 1;
      }
      if (!closed) used = src.length;
      var name = open[1].toLowerCase();
      var token = { type: 'container', raw: src.slice(0, used), name: name, args: open[2].trim(), text: inner.join('\n'), tokens: [] };
      if (MARKDOWN_BODY.indexOf(name) >= 0) this.lexer.blockTokens(token.text, token.tokens);
      return token;
    },
    renderer: function (tok) {
      var body = function (p) { return p.parser.parse(tok.tokens); };
      var args = tok.args;
      switch (tok.name) {
        case 'infobox': return renderInfobox(args, tok.text);
        case 'navbox': return renderNavbox(args, tok.text);
        case 'gallery': return renderGallery(args, tok.text);
        case 'figure': return renderFigure(args, tok.text);
        case 'note': case 'tip': case 'warning': case 'important': case 'info':
          return '<div class="callout callout-' + tok.name + '"><div class="callout-title">' +
            (args ? inl(args) : tok.name.charAt(0).toUpperCase() + tok.name.slice(1)) + '</div><div class="callout-body">' + body(this) + '</div></div>';
        case 'notice': case 'banner':
          return '<div class="notice">' + body(this) + '</div>';
        case 'hatnote': return '<div class="hatnote">' + body(this) + '</div>';
        case 'lead': return '<div class="lead">' + body(this) + '</div>';
        case 'quote':
          return '<blockquote class="pullquote">' + body(this) + (args ? '<footer>' + inl(args) + '</footer>' : '') + '</blockquote>';
        case 'collapse':
          return '<details class="collapsible"><summary>' + (args ? inl(args) : 'Show') + '</summary><div class="collapsible-body">' + body(this) + '</div></details>';
        case 'columns':
          return '<div class="columns" style="--cols:' + (parseInt(args, 10) || 2) + '">' + body(this) + '</div>';
        case 'grid':
          return '<div class="grid" style="--cols:' + (parseInt(args, 10) || 2) + '">' + body(this) + '</div>';
        case 'box':
          return '<section class="box"><div class="box-title">' + inl(args || '') + '</div><div class="box-body">' + body(this) + '</div></section>';
        case 'center': return '<div class="center">' + body(this) + '</div>';
        case 'aside': return '<aside class="side-box">' + (args ? '<div class="side-box-title">' + inl(args) + '</div>' : '') + body(this) + '</aside>';
        case 'references': return body(this) + '<!--REFLIST-->';
        default:
          return '<div class="block-' + esc(tok.name) + '">' + (tok.tokens.length ? body(this) : md.parse(tok.text)) + '</div>';
      }
    }
  };

  var blockTemplateExt = {
    name: 'blocktemplate', level: 'block',
    start: function (src) { var m = src.match(/\n\{\{/); return m ? m.index + 1 : undefined; },
    tokenizer: function (src) {
      var m = /^\{\{([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}[ \t]*(?:\n|$)/.exec(src);
      if (!m) return;
      var name = m[1].split('|')[0].trim().toLowerCase();
      if (['main', 'see also', 'further', 'reflist', 'references', 'clear', 'category list', 'pages in', 'recent changes', 'recent'].indexOf(name) < 0) return;
      return { type: 'blocktemplate', raw: m[0], inner: m[1] };
    },
    renderer: function (tok) { return renderBlockTemplate(tok.inner) || ''; }
  };

  var wikiLinkExt = {
    name: 'wikilink', level: 'inline',
    start: function (src) { var i = src.indexOf('[['); return i < 0 ? undefined : i; },
    tokenizer: function (src) {
      var m = /^\[\[([^\[\]]+)\]\]([\p{Ll}]*)/u.exec(src);
      if (m) return { type: 'wikilink', raw: m[0], inner: m[1], trail: m[2] };
    },
    renderer: function (tok) { return renderWikiLink(tok.inner, tok.trail); }
  };

  var templateExt = {
    name: 'template', level: 'inline',
    start: function (src) { var i = src.indexOf('{{'); return i < 0 ? undefined : i; },
    tokenizer: function (src) {
      if (src.slice(0, 2) !== '{{') return;
      var depth = 0;
      for (var i = 0; i < src.length - 1; i++) {
        var two = src.substr(i, 2);
        if (two === '{{') { depth++; i++; }
        else if (two === '}}') { depth--; i++; if (depth === 0) return { type: 'template', raw: src.slice(0, i + 1), inner: src.slice(2, i - 1) }; }
      }
    },
    renderer: function (tok) { return renderTemplate(tok.inner); }
  };

  var footnoteExt = {
    name: 'footnote', level: 'inline',
    start: function (src) { var i = src.indexOf('[^'); return i < 0 ? undefined : i; },
    tokenizer: function (src) {
      var m = /^\[\^([^\]\s]+)\]/.exec(src);
      if (m) return { type: 'footnote', raw: m[0], name: m[1] };
    },
    renderer: function (tok) { return addRef(tok.name, null); }
  };

  md.use({
    extensions: [containerExt, blockTemplateExt, wikiLinkExt, templateExt, footnoteExt],
    renderer: {
      heading: function (text, level, raw) {
        var id = uniqueId(slugify(raw || text));
        if (R) R.headings.push({ level: level, text: stripTags(text), id: id });
        return '<h' + level + ' id="' + id + '"><span class="h-text">' + text + '</span>' +
          '<a class="h-anchor" href="' + hrefFor(R ? R.title : '', id) + '" aria-label="Link to this section">#</a></h' + level + '>\n';
      },
      table: function (header, body) {
        return '<div class="table-wrap"><table class="wikitable sortable"><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>\n';
      },
      link: function (href, title, text) {
        if (href == null) return text;
        var ext = /^(https?:)?\/\//i.test(href);
        var isMail = /^mailto:/i.test(href);
        return '<a href="' + esc(href) + '"' + (title ? ' title="' + esc(title) + '"' : '') +
          (ext ? ' class="external" target="_blank" rel="noopener"' : (isMail ? ' class="external"' : '')) + '>' + text + '</a>';
      },
      image: function (href, title, text) {
        return '<img src="' + esc(imgSrc(href)) + '" alt="' + esc(text) + '"' + (title ? ' title="' + esc(title) + '"' : '') + ' loading="lazy">';
      }
    }
  });

  // In table rows, escape "|" inside [[ ]], {{ }} and `code` so they do not split cells.
  function protectTablePipes(line) {
    var out = '', depth = 0, code = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i], two = line.substr(i, 2);
      if (c === '\\') { out += two; i++; continue; }
      if (c === '`') { code = !code; out += c; continue; }
      if (!code && (two === '[[' || two === '{{')) { depth++; out += two; i++; continue; }
      if (!code && (two === ']]' || two === '}}') && depth) { depth--; out += two; i++; continue; }
      if (c === '|' && (depth || code)) { out += '\\|'; continue; }
      out += c;
    }
    return out;
  }

  function renderMarkdown(title, body) {
    var saved = R;
    R = newState(title);
    // Collect footnote definitions ("[^id]: text"), skipping code blocks.
    var fence = null;
    var src = body.split('\n').filter(function (line) {
      var f = line.match(/^[ \t]*(```|~~~)/);
      if (f) { fence = fence === f[1] ? null : (fence || f[1]); return true; }
      if (fence) return true;
      var d = line.match(/^\[\^([^\]\s]+)\]:[ \t]+(.*)$/);
      if (d) { R.defs[d[1]] = d[2]; return false; }
      return true;
    }).map(function (line) {
      return /^\s*\|/.test(line) ? protectTablePipes(line) : line;
    }).join('\n');
    var scan = stripCode(src);
    var usesRefs = /\[\^[^\]\s]+\]|\{\{\s*ref\s*\|/i.test(scan);
    var hasList = /^\{\{\s*(reflist|references)\s*\}\}|^[ \t]*:::references/im.test(scan);
    if (usesRefs && !hasList) {
      var navAt = -1, pos = 0, inFence = null;
      src.split('\n').some(function (line) {
        var f = line.match(/^[ \t]*(```|~~~)/);
        if (f) inFence = inFence === f[1] ? null : (inFence || f[1]);
        else if (!inFence && /^[ \t]*:::navbox/.test(line)) { navAt = pos; return true; }
        pos += line.length + 1;
        return false;
      });
      var block = '\n\n## References\n\n{{reflist}}\n\n';
      src = navAt >= 0 ? src.slice(0, navAt) + block + src.slice(navAt) : src + block;
    }
    var html;
    try {
      html = md.parse(src);
    } catch (e) {
      console.error(e);
      html = '<div class="callout callout-warning"><div class="callout-title">This page could not be rendered</div><div class="callout-body"><pre>' + esc(e.message) + '</pre></div></div>';
    }
    html = html.replace('<!--REFLIST-->', reflistHtml()).replace(/<!--REFLIST-->/g, '');
    var out = { html: html, headings: R.headings };
    R = saved;
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Page summaries (search, hover previews)                             */
  /* ------------------------------------------------------------------ */

  var cache = {};
  function digest(p) {
    if (cache[p.file]) return cache[p.file];
    var d = document.createElement('div');
    d.innerHTML = renderMarkdown(p.title, p.body).html;
    var img = p.meta.image ? imgSrc(p.meta.image) : null;
    if (!img) { var ib = d.querySelector('.infobox img, figure img'); if (ib) img = ib.getAttribute('src'); }
    d.querySelectorAll('.infobox, .navbox, .references, .hatnote, figure, .gallery, sup.ref, .h-anchor, table').forEach(function (n) { n.remove(); });
    var summary = p.meta.summary || p.meta.description || '';
    if (!summary) {
      var ps = d.querySelectorAll('p');
      for (var i = 0; i < ps.length; i++) { var tx = ps[i].textContent.trim(); if (tx.length > 30) { summary = tx; break; } }
    }
    var text = d.textContent.replace(/\s+/g, ' ').trim();
    cache[p.file] = { summary: summary, image: img, text: text };
    return cache[p.file];
  }

  /* ------------------------------------------------------------------ */
  /* Views                                                               */
  /* ------------------------------------------------------------------ */

  var $ = function (id) { return document.getElementById(id); };
  var els = {};
  var current = { key: null, view: null };

  function setChrome(opts) {
    els.title.innerHTML = opts.titleHtml || esc(opts.title);
    document.title = opts.title + ' | ' + CFG.siteName;
    els.sub.innerHTML = opts.sub || '';
    els.sub.hidden = !opts.sub;
    els.body.innerHTML = opts.html || '';
    els.cats.innerHTML = opts.catsHtml || '';
    els.cats.hidden = !opts.catsHtml;
    els.foot.innerHTML = opts.foot || '';
    els.tabs.innerHTML = opts.tabs || '';
    els.tools.innerHTML = opts.tools || '';
    els.tools.hidden = !opts.tools;
    buildToc(opts.headings || [], opts.toc !== false);
    els.page.classList.toggle('is-main', !!opts.isMain);
    enhance(els.body);
  }

  function tabsFor(title, active) {
    return '<a class="tab' + (active === 'read' ? ' active' : '') + '" href="' + hrefFor(title) + '">Read</a>' +
      '<a class="tab' + (active === 'source' ? ' active' : '') + '" href="' + hrefFor(title, '', 'action=source') + '">Source</a>';
  }
  function toolsFor(title, p) {
    return '<h3>This page</h3><ul>' +
      '<li><a href="' + hrefFor('Special:WhatLinksHere/' + title) + '">What links here</a></li>' +
      (p ? '<li><a href="' + hrefFor(title, '', 'action=source') + '">View source</a></li>' : '') +
      '<li><a href="#" data-action="print">Print this page</a></li>' +
      '<li><a href="#" data-action="copylink">Copy link</a></li></ul>';
  }
  function catBox(cats) {
    if (!cats.length) return '';
    return '<span class="cat-label">' + (cats.length > 1 ? 'Categories' : 'Category') + '</span><ul>' + cats.map(function (c) {
      return '<li>' + renderWikiLink(':Category:' + c + '|' + c, '') + '</li>';
    }).join('') + '</ul>';
  }
  function footFor(p) {
    if (!p) return '';
    var out = p.mtime ? 'This page was last edited on ' + esc(fmtDate(p.mtime)) + '.' : '';
    if (p.hash) {
      out += '<div class="page-id">Page ID: <code class="hash" title="SHA-256: ' + esc(p.hash) + '. Click to copy." data-action="copyhash" data-hash="' + esc(p.hash) + '">' +
        esc(p.hash.slice(0, 16)) + '</code></div>';
    }
    return out;
  }


  // Articles are ordinary wiki pages: not help, category, redirect or the main page.
  function isArticle(p) {
    return !p.isHelp && !p.isCategory && !p.redirect && keyOf(p.title) !== keyOf(CFG.mainPage);
  }
  function hasAiContent(p) {
    var v = p.meta.ai;
    if (v === true || v === false) return v;
    return !!CFG.aiByDefault;
  }
  function aiBadge() {
    return '<a class="ai-badge" href="' + esc(CFG.aiPolicyPage) + '" title="This page contains AI-generated content. Read our AI Policy.">' +
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M10 3.5l1.6 4.4a3 3 0 0 0 1.8 1.8L17.8 11.3l-4.4 1.6a3 3 0 0 0-1.8 1.8L10 19.1l-1.6-4.4a3 3 0 0 0-1.8-1.8L2.2 11.3l4.4-1.6a3 3 0 0 0 1.8-1.8z" fill="currentColor"/><path d="M18.5 2.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" fill="currentColor"/></svg>' +
      '<span>Contains AI-generated content</span></a>';
  }

  function viewArticle(p, opts) {
    opts = opts || {};
    var r = renderMarkdown(p.title, p.body);
    var isMain = keyOf(p.title) === keyOf(CFG.mainPage);
    var sub = '';
    if (!isMain) sub = 'From ' + esc(CFG.siteName) + (CFG.tagline ? ', ' + esc(CFG.tagline.charAt(0).toLowerCase() + CFG.tagline.slice(1)) : '');
    if (opts.from) sub += (sub ? '<br>' : '') + '<span class="redirected">(Redirected from <a href="' + hrefFor(opts.from, '', 'redirect=no') + '">' + esc(opts.from) + '</a>)</span>';
    var html = r.html;
    if (p.isCategory) html += categoryListing(p.title.replace(/^Category:/, ''));
    if (isArticle(p) && hasAiContent(p)) sub = '<span class="sub-text">' + sub + '</span>' + aiBadge();
    var tocAllowed = p.meta.toc !== false && !isMain;
    setChrome({
      title: p.meta.displaytitle || p.title,
      titleHtml: p.meta.displaytitle ? inl(p.meta.displaytitle) : null,
      sub: sub, html: html, headings: r.headings,
      toc: tocAllowed && (p.meta.toc === true || r.headings.filter(function (h) { return h.level >= 2; }).length >= 3),
      catsHtml: catBox(p.cats), foot: footFor(p), tabs: tabsFor(p.title, 'read'),
      tools: toolsFor(p.title, p), isMain: isMain || p.meta.layout === 'main'
    });
  }

  function viewSource(p, title) {
    setChrome({
      title: 'Source of ' + (p ? p.title : title),
      sub: p ? 'This page is written in the Markdown file <code>pages/' + esc(p.file) + '</code>. Edit that file, then run <code>build.command</code> and reload.' : '',
      html: p ? '<div class="source-actions"><button type="button" class="btn" data-action="copysource">Copy source</button></div><pre class="source"><code>' + esc(p.raw) + '</code></pre>' : '<p>This page has no source because it does not exist.</p>',
      tabs: tabsFor(p ? p.title : title, 'source'), tools: toolsFor(p ? p.title : title, p), foot: footFor(p)
    });
  }

  function suggestedFile(title) {
    return title.replace(/^([^:]+):/, '$1-').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') + '.md';
  }

  function viewMissing(title) {
    var file = suggestedFile(title);
    var catM = title.match(/^Category:(.+)$/);
    var html = '<div class="missing">' +
      '<p>There is currently no page called <b>' + esc(title) + '</b>.</p>' +
      '<p><a href="' + hrefFor('Special:Search', '', 'q=' + encodeURIComponent(title)) + '">Search for "' + esc(title) + '"</a> in other pages, or ' +
      '<a href="' + hrefFor('Special:WhatLinksHere/' + title) + '">see which pages link here</a>.</p>' +
      '<div class="callout callout-tip"><div class="callout-title">Create this page</div><div class="callout-body">' +
      '<p>Make a new file called <code>pages/' + esc(file) + '</code> containing:</p>' +
      '<pre class="source"><code>---\ntitle: ' + esc(title) + '\ncategories: []\n---\n\n**' + esc(title.replace(/^[^:]+:/, '')) + '** is ...</code></pre>' +
      '<p>Then double-click <code>build.command</code> and reload this page.</p></div></div></div>';
    if (catM) html = categoryListing(catM[1]) + html;
    setChrome({ title: title, html: html, tabs: tabsFor(title, 'read'), tools: toolsFor(title, null), toc: false });
    els.title.classList.add('is-new');
  }

  function groupedList(pages) {
    if (!pages.length) return '<p class="muted">Nothing here yet.</p>';
    var groups = {};
    pages.forEach(function (p) {
      var t = p.title.replace(/^[^:]+:/, '');
      var L = t.normalize('NFD').charAt(0).toUpperCase();
      if (!/\p{L}/u.test(L)) L = '#';
      (groups[L] = groups[L] || []).push(p);
    });
    return '<div class="az">' + Object.keys(groups).sort().map(function (L) {
      return '<div class="az-group"><div class="az-letter">' + esc(L) + '</div><ul>' + groups[L].map(function (p) {
        return '<li>' + renderWikiLink(':' + p.title, '') + (p.redirect ? ' <span class="muted">(redirect to ' + renderWikiLink(p.redirect, '') + ')</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }).join('') + '</div>';
  }

  function categoryListing(cat) {
    cat = normTitle(cat);
    var pages = (CATS[cat] || []).slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
    var subcats = pages.filter(function (p) { return p.isCategory; });
    var normal = pages.filter(function (p) { return !p.isCategory; });
    var out = '';
    if (subcats.length) out += '<h2 id="subcategories">Subcategories</h2>' + groupedList(subcats);
    out += '<h2 id="pages-in-category">Pages in category "' + esc(cat) + '"</h2>' +
      '<p class="muted">' + (normal.length === 1 ? 'This category contains 1 page.' : 'This category contains ' + normal.length + ' pages.') + '</p>' +
      groupedList(normal);
    return out;
  }

  function viewCategory(cat) {
    var p = getPage('Category:' + cat);
    if (p) return viewArticle(p);
    if (!CATS[normTitle(cat)]) return viewMissing('Category:' + normTitle(cat));
    setChrome({
      title: 'Category:' + normTitle(cat), html: categoryListing(cat),
      tabs: tabsFor('Category:' + cat, 'read'), tools: toolsFor('Category:' + cat, null), toc: false
    });
  }

  function viewSpecial(name, rest, params) {
    var n = name.toLowerCase();
    if (n === 'random') {
      var a = articles();
      if (!a.length) return viewArticle(getPage(CFG.mainPage) || { title: CFG.mainPage, body: '', meta: {}, cats: [] });
      var pick = a[Math.floor(Math.random() * a.length)];
      location.replace(hrefFor(pick.title));
      return;
    }
    if (n === 'allpages') {
      var all = LIST.filter(function (p) { return params.get('redirects') === 'yes' || !p.redirect; });
      return setChrome({
        title: 'All pages',
        sub: 'Every page on ' + esc(CFG.siteName) + ', alphabetically. ' + (params.get('redirects') === 'yes'
          ? '<a href="' + hrefFor('Special:AllPages') + '">Hide redirects</a>'
          : '<a href="' + hrefFor('Special:AllPages', '', 'redirects=yes') + '">Show redirects</a>'),
        html: groupedList(all), toc: false
      });
    }
    if (n === 'categories') {
      var names = Object.keys(CATS).sort();
      return setChrome({
        title: 'Categories', sub: 'All categories used by pages on ' + esc(CFG.siteName) + '.',
        html: names.length ? '<ul class="cat-index">' + names.map(function (c) {
          return '<li>' + renderWikiLink(':Category:' + c + '|' + c, '') + ' <span class="count">' + CATS[c].length + '</span></li>';
        }).join('') + '</ul>' : '<p class="muted">No categories yet.</p>', toc: false
      });
    }
    if (n === 'recentchanges') {
      var rec = LIST.slice().sort(function (x, y) { return (y.mtime || 0) - (x.mtime || 0); }).slice(0, 100);
      var lastDay = '', html = '';
      rec.forEach(function (p) {
        var day = p.mtime ? new Date(p.mtime * 1000).toLocaleDateString(CFG.dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Unknown date';
        if (day !== lastDay) { html += (lastDay ? '</ul>' : '') + '<h3 class="rc-day">' + esc(day) + '</h3><ul class="rc">'; lastDay = day; }
        var time = p.mtime ? new Date(p.mtime * 1000).toLocaleTimeString(CFG.dateLocale, { hour: '2-digit', minute: '2-digit' }) : '';
        html += '<li><span class="rc-time">' + esc(time) + '</span>' + renderWikiLink(':' + p.title, '') + ' <span class="muted">pages/' + esc(p.file) + '</span></li>';
      });
      if (lastDay) html += '</ul>';
      return setChrome({ title: 'Recent changes', sub: 'Pages ordered by when their file was last saved.', html: html, toc: false });
    }
    if (n === 'whatlinkshere') {
      var target = normTitle(rest || params.get('target') || '');
      var k = keyOf(target);
      var linking = LIST.filter(function (p) { return p.links.indexOf(k) >= 0 || (p.redirect && keyOf(p.redirect) === k); });
      var catM = target.match(/^Category:(.+)$/);
      if (catM) linking = linking.concat(CATS[normTitle(catM[1])] || []);
      return setChrome({
        title: 'Pages that link to "' + target + '"',
        sub: 'Back to ' + renderWikiLink(':' + target, ''),
        html: linking.length ? '<ul class="page-list">' + linking.map(function (p) {
          return '<li>' + renderWikiLink(':' + p.title, '') + (p.redirect ? ' <span class="muted">(redirect)</span>' : '') + '</li>';
        }).join('') + '</ul>' : '<p class="muted">No pages link to ' + esc(target) + '.</p>', toc: false
      });
    }
    if (n === 'search') {
      var q = (params.get('q') || '').trim();
      els.search.value = q;
      return setChrome({ title: 'Search results', html: searchResultsHtml(q), toc: false });
    }
    viewMissing('Special:' + name);
  }

  /* ------------------------------------------------------------------ */
  /* Search                                                              */
  /* ------------------------------------------------------------------ */

  function fold(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function search(q, limit) {
    var fq = fold(q).trim();
    if (!fq) return [];
    var words = fq.split(/\s+/);
    var results = [];
    LIST.forEach(function (p) {
      var ft = fold(p.title), score = 0;
      if (ft === fq) score += 100;
      else if (ft.indexOf(fq) === 0) score += 60;
      else if (ft.indexOf(fq) >= 0) score += 40;
      var d = digest(p), body = fold(d.text);
      var all = words.every(function (w) { return ft.indexOf(w) >= 0 || body.indexOf(w) >= 0; });
      if (!score && !all) return;
      if (all) words.forEach(function (w) { var c = body.split(w).length - 1; score += Math.min(c, 10); });
      if (p.redirect) score -= 5;
      results.push({ p: p, score: score, d: d });
    });
    results.sort(function (a, b) { return b.score - a.score || a.p.title.localeCompare(b.p.title); });
    return limit ? results.slice(0, limit) : results;
  }

  function snippet(text, q) {
    var ft = fold(text), fq = fold(q).split(/\s+/)[0];
    var i = ft.indexOf(fq);
    var start = Math.max(0, i - 80), s = text.slice(start, start + 240);
    var out = (start > 0 ? '…' : '') + esc(s) + (start + 240 < text.length ? '…' : '');
    fold(q).split(/\s+/).filter(Boolean).forEach(function (w) {
      // Highlight matches, comparing without diacritics.
      var src = out, res = '', fsrc = fold(src), idx = 0, j;
      while ((j = fsrc.indexOf(w, idx)) >= 0 && w.length > 1) {
        res += src.slice(idx, j) + '<mark>' + src.slice(j, j + w.length) + '</mark>';
        idx = j + w.length;
      }
      out = res + src.slice(idx);
    });
    return out;
  }

  function searchResultsHtml(q) {
    if (!q) return '<p class="muted">Type something in the search box.</p>';
    var res = search(q);
    var exact = getPage(q);
    var head = exact ? '<p>There is a page named ' + renderWikiLink(':' + exact.title, '') + ' on this wiki.</p>'
      : '<p>No page is titled "' + esc(q) + '". You can ' + renderWikiLink(':' + normTitle(q) + '|create it', '') + '.</p>';
    if (!res.length) return head + '<p class="muted">No results matched your search.</p>';
    return head + '<p class="muted">' + res.length + ' result' + (res.length === 1 ? '' : 's') + '</p><ul class="search-results">' + res.map(function (r) {
      return '<li>' + renderWikiLink(':' + r.p.title, '') + '<div class="sr-snippet">' + (r.p.redirect ? 'Redirect to ' + esc(r.p.redirect) : snippet(r.d.text || r.d.summary, q)) + '</div></li>';
    }).join('') + '</ul>';
  }

  function setupSearch() {
    var input = els.search, box = els.suggest, sel = -1, items = [];
    function close() { box.hidden = true; sel = -1; input.setAttribute('aria-expanded', 'false'); }
    function draw() {
      var q = input.value.trim();
      if (!q) { close(); return; }
      items = search(q, 8);
      box.innerHTML = items.map(function (r, i) {
        return '<a href="' + hrefFor(r.p.redirect || r.p.title) + '" class="sg-item' + (i === sel ? ' active' : '') + '">' +
          (r.d.image ? '<img src="' + esc(r.d.image) + '" alt="">' : '<span class="sg-noimg"></span>') +
          '<span class="sg-text"><span class="sg-title">' + esc(r.p.title) + '</span>' +
          '<span class="sg-desc">' + esc(r.p.redirect ? 'Redirect to ' + r.p.redirect : (r.p.meta.description || r.d.summary || '').slice(0, 90)) + '</span></span></a>';
      }).join('') + '<a class="sg-all" href="' + hrefFor('Special:Search', '', 'q=' + encodeURIComponent(q)) + '">Search for pages containing <b>' + esc(q) + '</b></a>';
      box.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', function () { sel = -1; draw(); });
    input.addEventListener('focus', function () { if (input.value.trim()) draw(); });
    input.addEventListener('keydown', function (e) {
      var links = box.querySelectorAll('a');
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, links.length - 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, -1); draw(); }
      else if (e.key === 'Escape') { close(); input.blur(); }
      else if (e.key === 'Enter' && sel >= 0 && links[sel]) { e.preventDefault(); location.hash = links[sel].getAttribute('href'); close(); input.blur(); }
    });
    document.addEventListener('click', function (e) { if (!els.searchForm.contains(e.target)) close(); });
    box.addEventListener('click', function () { setTimeout(close, 0); input.blur(); });
    els.searchForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q) return;
      close(); input.blur();
      var p = getPage(q);
      location.hash = p ? hrefFor(p.title) : hrefFor('Special:Search', '', 'q=' + encodeURIComponent(q));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Table of contents                                                   */
  /* ------------------------------------------------------------------ */

  var spy = null;
  function buildToc(headings, show) {
    if (spy) { spy.disconnect(); spy = null; }
    var hs = headings.filter(function (h) { return h.level >= 2 && h.level <= 4; });
    if (!show || !hs.length) { els.toc.innerHTML = ''; els.toc.hidden = true; return; }
    var min = Math.min.apply(null, hs.map(function (h) { return h.level; }));
    var counters = [0, 0, 0];
    var list = hs.map(function (h) {
      var d = h.level - min;
      counters[d]++;
      for (var i = d + 1; i < counters.length; i++) counters[i] = 0;
      var num = counters.slice(0, d + 1).join('.');
      return '<li class="toc-l' + d + '"><a href="' + hrefFor(current.title, h.id) + '" data-id="' + esc(h.id) + '"><span class="toc-num">' + num + '</span><span class="toc-text">' + esc(h.text) + '</span></a></li>';
    }).join('');
    var top = '<li class="toc-l0 toc-top"><a href="' + hrefFor(current.title, 'top') + '" data-id="top"><span class="toc-text">(Top)</span></a></li>';
    els.toc.innerHTML = '<div class="toc-head"><span>Contents</span><button type="button" class="toc-toggle" aria-expanded="true">hide</button></div><ol>' + top + list + '</ol>';
    els.toc.hidden = false;
    // Inline copy for narrow screens, placed before the first section like a printed encyclopedia.
    var inline = document.createElement('nav');
    inline.className = 'toc-inline';
    inline.setAttribute('aria-label', 'Contents');
    inline.innerHTML = '<details open><summary>Contents</summary><ol>' + list + '</ol></details>';
    var firstH = els.body.querySelector(':scope > h2, :scope > h3');
    if (firstH) els.body.insertBefore(inline, firstH); else els.body.appendChild(inline);

    var toggle = els.toc.querySelector('.toc-toggle');
    toggle.addEventListener('click', function () {
      var hidden = els.toc.classList.toggle('collapsed');
      toggle.textContent = hidden ? 'show' : 'hide';
      toggle.setAttribute('aria-expanded', String(!hidden));
    });

    if ('IntersectionObserver' in window) {
      var links = {};
      els.toc.querySelectorAll('a[data-id]').forEach(function (a) { links[a.dataset.id] = a; });
      var visible = {};
      spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : undefined; });
        var heads = hs.map(function (h) { return document.getElementById(h.id); }).filter(Boolean);
        var activeId = 'top';
        for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < 120) activeId = heads[i].id; }
        Object.keys(links).forEach(function (id) { links[id].classList.toggle('active', id === activeId); });
      }, { rootMargin: '0px 0px -60% 0px' });
      hs.forEach(function (h) { var el = document.getElementById(h.id); if (el) spy.observe(el); });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Enhancements after render                                           */
  /* ------------------------------------------------------------------ */

  function enhance(root) {
    root.querySelectorAll('table.sortable').forEach(makeSortable);
  }

  function makeSortable(table) {
    var head = table.tHead && table.tHead.rows[0];
    if (!head || table.tBodies[0].rows.length < 3) { table.classList.remove('sortable'); return; }
    Array.prototype.forEach.call(head.cells, function (th, col) {
      th.tabIndex = 0;
      th.setAttribute('role', 'button');
      th.title = 'Sort by this column';
      var dir = 0;
      function sort() {
        dir = dir === 1 ? -1 : 1;
        Array.prototype.forEach.call(head.cells, function (c) { c.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows);
        rows.sort(function (a, b) {
          var x = (a.cells[col] || {}).textContent || '', y = (b.cells[col] || {}).textContent || '';
          var nx = parseFloat(x.replace(/[^\d.\-]/g, '')), ny = parseFloat(y.replace(/[^\d.\-]/g, ''));
          if (!isNaN(nx) && !isNaN(ny) && /^\s*[\d.,\-]/.test(x) && /^\s*[\d.,\-]/.test(y)) return (nx - ny) * dir;
          return x.localeCompare(y) * dir;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener('click', sort);
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
    });
  }

  /* Hover previews for internal links */
  function setupPreviews() {
    var card = document.createElement('div');
    card.className = 'preview';
    card.hidden = true;
    document.body.appendChild(card);
    var timer = null, hideTimer = null, anchor = null;
    // Cancel anything pending as well as hiding, so a preview can never appear after the page has changed.
    function hide() {
      clearTimeout(timer); clearTimeout(hideTimer);
      timer = hideTimer = null;
      card.hidden = true; anchor = null;
    }
    document.addEventListener('mouseover', function (e) {
      if (card.contains(e.target)) { clearTimeout(hideTimer); return; }
      var a = e.target.closest && e.target.closest('a.wl');
      if (!a || a.classList.contains('new') || a === anchor) return;
      if (a.closest('.preview, .suggest, .side-toc, .toc-inline')) return;
      var title = a.dataset.title;
      if (!title || /^Special:/.test(title)) return;
      var p = getPage(title);
      if (!p) return;
      if (p.redirect) p = getPage(p.redirect) || p;
      if (keyOf(p.title) === keyOf(current.title)) return;
      clearTimeout(timer); clearTimeout(hideTimer);
      timer = setTimeout(function () {
        timer = null;
        // Only show if the link is still on the page and still under the pointer.
        if (!a.isConnected || !a.matches(':hover')) return;
        var d = digest(p);
        if (!d.summary) return;
        anchor = a;
        card.innerHTML = (d.image ? '<img class="pv-img" src="' + esc(d.image) + '" alt="">' : '') +
          '<div class="pv-body"><div class="pv-title">' + esc(p.title) + '</div><p>' + esc(d.summary.length > 320 ? d.summary.slice(0, 320).replace(/\s\S*$/, '') + '\u2026' : d.summary) + '</p></div>';
        card.hidden = false;
        var r = a.getBoundingClientRect();
        var w = card.offsetWidth, h = card.offsetHeight;
        var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
        var top = r.bottom + 8;
        if (top + h > window.innerHeight - 8) top = r.top - h - 8;
        card.style.left = (left + window.scrollX) + 'px';
        card.style.top = (top + window.scrollY) + 'px';
      }, 450);
    });
    document.addEventListener('mouseout', function (e) {
      var a = e.target.closest && e.target.closest('a.wl');
      if (a || card.contains(e.target)) {
        clearTimeout(timer); timer = null;
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 250);
      }
    });
    // Any click, key press, navigation or scroll closes the preview.
    document.addEventListener('mousedown', function (e) { if (!card.contains(e.target)) hide(); }, true);
    document.addEventListener('keydown', hide, true);
    window.addEventListener('hashchange', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('scroll', function () { if (!card.hidden || timer) hide(); }, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Router                                                              */
  /* ------------------------------------------------------------------ */

  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var hashAt = raw.indexOf('#');
    var anchor = hashAt >= 0 ? raw.slice(hashAt + 1) : '';
    var pathq = hashAt >= 0 ? raw.slice(0, hashAt) : raw;
    var qAt = pathq.indexOf('?');
    var path = qAt >= 0 ? pathq.slice(0, qAt) : pathq;
    var qs = qAt >= 0 ? pathq.slice(qAt + 1) : '';
    try { path = decodeURIComponent(path); } catch (e) { /* keep as is */ }
    try { anchor = decodeURIComponent(anchor); } catch (e) { /* keep */ }
    return { title: normTitle(path) || CFG.mainPage, qs: qs, anchor: anchor, params: new URLSearchParams(qs) };
  }

  function scrollToAnchor(anchor, smooth) {
    if (!anchor || anchor === 'top') { window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' }); return; }
    var el = document.getElementById(anchor) || document.getElementById(slugify(anchor));
    if (el) {
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    }
  }

  function route() {
    var h = parseHash();
    var viewKey = keyOf(h.title) + '?' + h.qs;
    if (viewKey === current.key) { scrollToAnchor(h.anchor, true); return; }
    current.key = viewKey;
    current.title = h.title;
    els.title.classList.remove('is-new');
    closeMenu();

    var sp = h.title.match(/^Special:([^\/]+)(?:\/(.*))?$/);
    var cat = h.title.match(/^Category:(.+)$/);
    var p = getPage(h.title);

    if (h.params.get('action') === 'source') viewSource(p, h.title);
    else if (sp) viewSpecial(sp[1], sp[2], h.params);
    else if (p && p.redirect && h.params.get('redirect') !== 'no') {
      var target = getPage(p.redirect);
      if (target) {
        current.title = target.title;
        current.key = keyOf(target.title) + '?';
        history.replaceState(null, '', hrefFor(target.title, h.anchor));
        viewArticle(target, { from: p.title });
      } else viewMissing(p.redirect);
    }
    else if (p) viewArticle(p);
    else if (cat) viewCategory(cat[1]);
    else viewMissing(h.title);

    markActiveNav();
    if (h.anchor) setTimeout(function () { scrollToAnchor(h.anchor, false); }, 0);
    else window.scrollTo(0, 0);
  }

  function markActiveNav() {
    document.querySelectorAll('.side-nav a, .toplinks a').forEach(function (a) {
      var t = a.getAttribute('href');
      a.classList.toggle('active', t === hrefFor(current.title));
    });
  }

  function openMenu() { document.body.classList.add('menu-open'); els.menuBtn.setAttribute('aria-expanded', 'true'); }
  function closeMenu() { document.body.classList.remove('menu-open'); if (els.menuBtn) els.menuBtn.setAttribute('aria-expanded', 'false'); }

  function init() {
    els = {
      page: $('page'), title: $('pageTitle'), sub: $('pageSub'), body: $('pageBody'), cats: $('catlinks'),
      foot: $('pageFoot'), tabs: $('tabs'), tools: $('pageTools'), toc: $('sideToc'),
      search: $('searchInput'), suggest: $('suggest'), searchForm: $('searchForm'), menuBtn: $('menuBtn')
    };
    document.querySelectorAll('[data-sitename]').forEach(function (n) { n.textContent = CFG.siteName; });
    document.querySelectorAll('[data-tagline]').forEach(function (n) { n.textContent = CFG.tagline; });
    els.search.placeholder = 'Search ' + CFG.siteName;
    if (CFG.logo) document.querySelectorAll('.brand-mark').forEach(function (n) { n.innerHTML = '<img src="' + esc(CFG.logo) + '" alt="">'; });
    var foot = $('siteFoot');
    if (foot && CFG.footer) foot.innerHTML = inl(CFG.footer);

    if (!window.WIKI_FILES) {
      setChrome({
        title: 'No pages found',
        html: '<div class="callout callout-warning"><div class="callout-title">The page bundle is missing</div><div class="callout-body">' +
          '<p>The wiki could not find <code>pages/_bundle.js</code>. Double-click <code>build.command</code> in the site folder to create it, then reload.</p></div></div>'
      });
      return;
    }

    setupSearch();
    setupPreviews();
    els.menuBtn.addEventListener('click', function () {
      document.body.classList.contains('menu-open') ? closeMenu() : openMenu();
    });
    $('scrim').addEventListener('click', closeMenu);

    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a) return;
      var act = a.dataset.action;
      if (act === 'print') { e.preventDefault(); window.print(); }
      if (act === 'copylink') {
        e.preventDefault();
        copy(location.href, a, 'Link copied');
      }
      if (act === 'copyhash') copy(a.dataset.hash, a, 'Copied');
      if (act === 'copysource') {
        var code = els.body.querySelector('pre.source code');
        if (code) copy(code.textContent, a, 'Copied');
      }
    });

    window.addEventListener('hashchange', route);
    route();
  }

  function copy(text, el, done) {
    var orig = el.textContent;
    var ok = function () { el.textContent = done; setTimeout(function () { el.textContent = orig; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { /* ignore */ }
      ta.remove();
    }
  }

  // Exposed for debugging in the browser console.
  window.Wiki = { pages: PAGES, list: LIST, categories: CATS, render: function (md) { return renderMarkdown('Preview', md).html; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
