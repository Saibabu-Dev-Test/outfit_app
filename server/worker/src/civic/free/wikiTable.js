// Tiny, dependency-free reader for Wikipedia "wikitable" HTML (MediaWiki action=parse output).
// Expands rowspan / colspan so every row has one text per column, which is what the Govt free
// sources need (ministers, MPs, MLAs tables). Pure functions only (tested); a regex reader, kept
// small and linear so it stays inside the Workers free-plan CPU budget.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', '#39': "'" };

export const decode = s =>
  String(s || '').replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] !== undefined ? ENTITIES[e.toLowerCase()] : m;
  });

// Cell HTML -> plain text: footnote marks [1] dropped, <br> = newline, tags removed, spaces folded
export const cellText = html =>
  decode(
    String(html || '')
      .replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(li|p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\[\d+\]|\[[a-z]\]|\[note \d+\]/gi, '')
    .split('\n')
    .map(x => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

const spanOf = (attrs, name) => {
  const m = new RegExp(`${name}\\s*=\\s*"?(\\d+)`, 'i').exec(attrs || '');
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= 400 ? n : 1;
};

// Every <table class="...wikitable..."> in the page HTML (outer HTML strings, nested tables kept)
export function wikiTables(html, max = 20) {
  const out = [];
  const re = /<table\b[^>]*class="[^"]*wikitable[^"]*"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < max) {
    // find the matching </table> (nested tables counted)
    let depth = 1;
    const tag = /<\/?table\b[^>]*>/gi;
    tag.lastIndex = re.lastIndex;
    let t;
    let end = -1;
    while ((t = tag.exec(html))) {
      depth += t[0][1] === '/' ? -1 : 1;
      if (depth === 0) {
        end = tag.lastIndex;
        break;
      }
    }
    if (end < 0) break;
    out.push(html.slice(m.index, end));
    re.lastIndex = end;
  }
  return out;
}

/**
 * One table -> rows of cells (plain text), rowspan / colspan expanded. Each row is
 * { cells: string[], header: boolean } (header = every cell was a <th>). Rows of a nested table
 * are skipped.
 */
export function parseTable(tableHtml) {
  const inner = String(tableHtml || '').replace(/^<table\b[^>]*>/i, '').replace(/<\/table>\s*$/i, '');
  // drop nested tables so their rows do not mix in
  const flat = inner.replace(/<table\b[\s\S]*?<\/table>/gi, '');
  const rows = [];
  const carry = []; // column -> { text, left } from rowspans above
  const trRe = /<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/tbody>|<\/thead>|$)/gi;
  let tr;
  while ((tr = trRe.exec(flat))) {
    const cells = [];
    let allTh = true;
    let any = false;
    const cellRe = /<(t[hd])\b([^>]*)>([\s\S]*?)(?=<t[hd]\b|<\/tr>|$)/gi;
    let c;
    let col = 0;
    const place = (text, colspan, rowspan) => {
      for (let k = 0; k < colspan; k += 1) {
        while (carry[col] && carry[col].left > 0) {
          cells[col] = carry[col].text;
          carry[col].left -= 1;
          col += 1;
        }
        cells[col] = text;
        if (rowspan > 1) carry[col] = { text, left: rowspan - 1 };
        col += 1;
      }
    };
    while ((c = cellRe.exec(tr[1]))) {
      any = true;
      if (c[1].toLowerCase() !== 'th') allTh = false;
      place(cellText(c[3].replace(/<\/t[hd]>\s*$/i, '')), spanOf(c[2], 'colspan'), spanOf(c[2], 'rowspan'));
    }
    // trailing columns still covered by rowspans
    while (carry[col] && carry[col].left > 0) {
      cells[col] = carry[col].text;
      carry[col].left -= 1;
      col += 1;
    }
    if (any) rows.push({ cells: Array.from(cells, x => x || ''), header: allTh });
  }
  return rows;
}

/**
 * The first table whose header row matches every regex in `need` -> { head, rows, cols } with
 * cols[name] = column index for each named regex in `cols` (first header cell that matches),
 * rows = the body rows (header rows removed). null when no table matches.
 */
export function findTable(html, need, cols = {}) {
  for (const t of wikiTables(html)) {
    const rows = parseTable(t);
    const headIdx = rows.findIndex(r => r.header && need.every(re => r.cells.some(x => re.test(x))));
    if (headIdx < 0) continue;
    const head = rows[headIdx].cells;
    // a second header row (e.g. "No. | Name" under "Constituency") refines the column names
    const sub = rows[headIdx + 1] && rows[headIdx + 1].header ? rows[headIdx + 1].cells : null;
    const names = head.map((h, i) => (sub && sub[i] && sub[i] !== h ? `${h} ${sub[i]}` : h));
    const idx = {};
    Object.entries(cols).forEach(([k, re]) => {
      idx[k] = names.findIndex(h => re.test(h));
    });
    return { head: names, rows: rows.slice(headIdx + (sub ? 2 : 1)), cols: idx };
  }
  return null;
}

// Value of a named column in a row; a colspan header ("Party" over a colour cell + the name) gives
// the first non-empty cell under that header.
export function cellAt(table, row, key) {
  const i = table && table.cols ? table.cols[key] : -1;
  if (i === undefined || i < 0) return '';
  const name = table.head[i];
  for (let j = i; j < row.cells.length && table.head[j] === name; j += 1) {
    if (row.cells[j]) return row.cells[j];
  }
  return '';
}
