/* Official original-law links. This module never reads or writes study history. */
(function () {
  'use strict';
  const laws = {
    '民法': '129AC0000000089',
    '商法': '132AC0000000048',
    '会社法': '417AC0000000086',
    '日本国憲法': '321CONSTITUTION',
    '憲法': '321CONSTITUTION',
    '刑法': '140AC0000000045',
    '民事訴訟法': '408AC0000000109',
    '民事執行法': '354AC0000000004',
    '民事保全法': '401AC0000000091',
    '不動産登記法': '416AC0000000123',
    '不動産登記令': '416CO0000000379',
    '不動産登記規則': '417M60000010018',
    '商業登記法': '338AC0000000125',
    '商業登記規則': '339M50000010023',
    '司法書士法': '325AC1000000197',
    '供託法': '132AC0000000015',
    '供託規則': '334M50000010002',
    '登録免許税法': '342AC0000000035',
    '登録免許税法施行規則': '342M50000040037',
    '借地借家法': '403AC0000000090',
    '農地法': '327AC0000000229',
    '一般法人法': '418AC0000000048',
    '一般社団法人及び一般財団法人に関する法律': '418AC0000000048',
    '会社法施行規則': '418M60000010012',
    '行政不服審査法': '426AC0000000068',
    '信託法': '418AC0000000108'
  };
  const names = Object.keys(laws).sort((a, b) => b.length - a.length).join('|');
  const number = '[0-9０-９一二三四五六七八九十百千〇零]+';
  const separator = '\\s*(?:・|、|及び|および|又は|から|～|〜|―|－)\\s*';
  const full = '第?' + number + '(?:条(?:の' + number + ')*|(?:の' + number + ')+条)(?:第?' + number + '項)?(?:第?' + number + '号(?:の' + number + ')*)?';
  // A number without 条 is accepted only when followed by an explicit article:
  // 民法４・５条. Neither isolated numbers nor 同法 are assigned a guessed law.
  const list = '(?:第?' + number + separator + ')*' + full + '(?:' + separator + full + ')*';
  const citations = new RegExp('(' + names + ')\\s*(' + list + ')', 'g');
  const pieces = new RegExp(full + '|第?' + number, 'g');
  const digits = '〇一二三四五六七八九';
  function numeric(value) {
    value = value.replace(/[０-９]/g, c => String(c.charCodeAt(0) - 65296));
    if (/^\d+$/.test(value)) return Number(value);
    if (!/[十百千]/.test(value)) return Number([...value].map(c => c === '零' ? 0 : digits.indexOf(c)).join(''));
    let total = 0, digit = 0;
    for (const c of value) {
      if ('十百千'.includes(c)) { total += (digit || 1) * ({十: 10, 百: 100, 千: 1000}[c]); digit = 0; }
      else digit = c === '零' ? 0 : digits.indexOf(c);
    }
    return total + digit;
  }
  function kanji(value) {
    if (!Number.isInteger(value) || value < 1 || value > 9999) return null;
    let text = '';
    for (const [unit, label] of [[1000, '千'], [100, '百'], [10, '十']]) {
      const n = Math.floor(value / unit);
      if (n) text += (n > 1 ? digits[n] : '') + label;
      value %= unit;
    }
    return text + (value ? digits[value] : '');
  }
  function references(text) {
    const result = [];
    for (const match of text.matchAll(citations)) {
      const prefix = text.slice(0, match.index).split(/[。！？\n]/).pop();
      // Historical references must keep their existing dated sources. Likewise,
      // do not mistake the suffix of an unknown law (e.g. 国際民法) for a known law.
      if (/(?:旧|改正前|試験時|当時)/.test(prefix) || /[一-龯]$/.test(prefix) && !/(?:現行|直接)$/.test(prefix)) continue;
      const law = match[1], start = match.index + match[0].indexOf(match[2]);
      let first = true;
      for (const part of match[2].matchAll(pieces)) {
        // Ignore paragraph/item numbers; only the number before 条 and its branches
        // are needed to locate the article heading in the official document.
        const raw = part[0].match(new RegExp('^第?(' + number + ')((?:の' + number + ')*)条?|^第?(' + number + ')'));
        if (!raw) continue;
        let nums = [raw[1] || raw[3]];
        const after = part[0].slice(raw[0].length);
        if (raw[2]) nums.push(...raw[2].split('の').filter(Boolean));
        const branches = after.match(new RegExp('^(?:の' + number + ')+'));
        if (branches) nums.push(...branches[0].split('の').filter(Boolean));
        const headingParts = nums.map(n => kanji(numeric(n)));
        if (headingParts.some(n => !n)) continue;
        const heading = '第' + headingParts[0] + '条' + headingParts.slice(1).map(n => 'の' + n).join('');
        result.push({
          start: first ? match.index : start + part.index,
          end: start + part.index + part[0].length,
          label: law + heading,
          // Text fragments avoid hard-coding chapter paths that can change after
          // amendments. Browsers without this feature still open the full law.
          href: 'https://laws.e-gov.go.jp/law/' + laws[law] + '#:~:text=' + encodeURIComponent(heading)
        });
        first = false;
      }
    }
    return result;
  }
  const rootIds = ['feedback', 'fiveFeedback', 'v15PastAnswer', 'v14libraryContent', 'v13content', 'v17CaseDetail'];
  const excluded = 'a,button,script,style,textarea,input,select,pre,code,.v184-law-help,.v15-law-note';
  function decorate(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement && !node.parentElement.closest(excluded)) nodes.push(node);
    }
    for (const node of nodes) {
      const matches = references(node.nodeValue);
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const ref of matches) {
        fragment.appendChild(document.createTextNode(node.nodeValue.slice(offset, ref.start)));
        const link = document.createElement('a');
        link.className = 'v184-law-link';
        link.href = ref.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = ref.label + 'の原文（e-Gov・現行法／別タブ）';
        link.setAttribute('aria-label', link.title);
        link.textContent = node.nodeValue.slice(ref.start, ref.end);
        fragment.appendChild(link);
        offset = ref.end;
      }
      fragment.appendChild(document.createTextNode(node.nodeValue.slice(offset)));
      node.replaceWith(fragment);
    }
    if (root.querySelector('.v184-law-link') && !root.querySelector('.v184-law-help')) {
      const help = document.createElement('p');
      help.className = 'muted v184-law-help';
      help.textContent = '下線の条文名を押すと、e-Govの原文を別タブで開きます（オンライン）。リンク先は現行法です。過去問は試験時の法令基準日と区別してください。該当条文に移動しない場合は、e-Govの目次から条番号を選んでください。';
      root.appendChild(help);
    }
  }
  function start() {
    const roots = rootIds.map(id => document.getElementById(id)).filter(Boolean);
    const observer = new MutationObserver(records => {
      const changed = roots.filter(root => records.some(r => root === r.target || root.contains(r.target)));
      observer.disconnect();
      try { changed.forEach(decorate); } finally { observe(); }
    });
    function observe() { roots.forEach(root => observer.observe(root, {childList: true, subtree: true, characterData: true})); }
    roots.forEach(decorate);
    observe();
  }
  // Export the pure parser for local tests, without depending on browser globals.
  if (typeof module !== 'undefined' && module.exports) module.exports = {references, numeric, kanji, decorate};
  if (typeof document !== 'undefined') start();
})();
