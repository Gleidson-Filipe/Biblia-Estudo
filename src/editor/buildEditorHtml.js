#!/usr/bin/env node
// Gera src/editor/editorHtml.js com TipTap embutido (sem KaTeX)
// Execute: node src/editor/buildEditorHtml.js

const fs = require('fs');
const path = require('path');

const bundle = fs.readFileSync(path.join(__dirname, 'tiptap-bundle.js'), 'utf8');

const editorScript = `
var _T = window.TipTapCore || window.TipTapBundle;
if (!_T) {
  var keys = Object.keys(window).filter(function(k){return k.toLowerCase().includes('tip')||k.toLowerCase().includes('editor');}).join(', ');
  document.body.innerHTML='<div style="color:red;padding:20px">TipTap failed. window keys: '+keys+'</div>';
  throw new Error('no TipTap');
}

// VerseChip node — chip de versículo inline
var VerseChip = _T.Node.create({
  name: 'verseChip', inline: true, group: 'inline', atom: true, selectable: true, draggable: false,
  addAttributes() {
    return {
      id: { default: null, parseHTML: el => el.getAttribute('data-id'), renderHTML: attrs => ({ 'data-id': attrs.id }) },
      label: { default: '', parseHTML: el => el.textContent, renderHTML: () => ({}) },
      accentColor: { default: '#4A90E2', parseHTML: el => el.style.color || '#4A90E2', renderHTML: () => ({}) },
    };
  },
  parseHTML() { return [{ tag: 'span.verse-chip' }]; },
  renderHTML({ node }) {
    var span = document.createElement('span');
    span.className = 'verse-chip';
    span.contentEditable = 'false';
    span.setAttribute('data-id', node.attrs.id || '');
    span.style.color = node.attrs.accentColor || '#4A90E2';
    span.style.borderColor = node.attrs.accentColor || '#4A90E2';
    span.textContent = node.attrs.label || '';
    return { dom: span };
  }
});

// Sentinela anti-capitalização automática (U+3164 Hangul Filler)
var Sentinela = _T.Node.create({
  name: 'sentinela', inline: true, group: 'inline', atom: true, selectable: false, draggable: false,
  parseHTML() { return [{ tag: 'span.sentinela-anti-caps' }]; },
  renderHTML() {
    var s = document.createElement('span');
    s.className = 'sentinela-anti-caps';
    s.textContent = '\\u3164';
    return { dom: s };
  }
});

// Underline via Highlight reutilizado como underline (Mark está disponível via _T.Node base)
// Usamos execCommand como fallback pois Mark não está no bundle do flashcards
var UnderlineMark = _T.Node.create ? null : null; // placeholder

var tiptapEditor = new _T.Editor({
  element: document.getElementById('editor-container'),
  extensions: [_T.Document, _T.Paragraph, _T.Text, _T.Bold, _T.Italic, _T.Highlight.configure({ multicolor: false, HTMLAttributes: { class: 'destaque' } }), _T.History, VerseChip, Sentinela],
  content: '',
  autofocus: true,
  editorProps: {
    attributes: {
      'data-placeholder': 'Escreva sua nota...',
      'spellcheck': 'true',
      'autocapitalize': 'none',
    },
    handlePaste: function(view, event) {
      var text = (event.clipboardData || window.clipboardData).getData('text/plain') || '';
      if (!text) return false;
      tiptapEditor.chain().focus().insertContent(text).run();
      return true;
    }
  },
  onFocus: function() { sendToApp('FOCUS', {}); },
  onUpdate: function() {
    sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
    updatePlaceholder();
  },
  onCreate: function() {
    proseMirrorEl = document.querySelector('.ProseMirror');
    if (proseMirrorEl) {
      proseMirrorEl.setAttribute('autocapitalize', 'none');
      proseMirrorEl.setAttribute('autocorrect', 'off');
      proseMirrorEl.setAttribute('autocomplete', 'off');
      proseMirrorEl.setAttribute('spellcheck', 'false');
    }
    attachListeners();
    updatePlaceholder();
  }
});

var proseMirrorEl = null;
var MAX_CHARS = 500;
var ACCENT = '#4A90E2';

function sendToApp(type, data) {
  if (window.ReactNativeWebView)
    window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, data)));
}

function getFullHtml() { return proseMirrorEl ? proseMirrorEl.innerHTML : ''; }

function getPlainText() {
  if (!proseMirrorEl) return '';
  var walker = document.createTreeWalker(proseMirrorEl, NodeFilter.SHOW_TEXT, function(n) {
    if (n.parentNode.classList && n.parentNode.classList.contains('sentinela-anti-caps')) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  });
  var t = '', n;
  while (n = walker.nextNode()) t += n.textContent.replace(/ㅤ/g, '');
  return t;
}

function countChars() {
  var text = getPlainText();
  return text.replace(/\\n/g, '').length;
}

function updatePlaceholder() {
  if (!proseMirrorEl) return;
  var empty = tiptapEditor.isEmpty && !proseMirrorEl.querySelector('.verse-chip');
  if (empty) proseMirrorEl.classList.add('is-empty');
  else proseMirrorEl.classList.remove('is-empty');
}

window.setAccentColor = function(color) {
  ACCENT = color;
  document.querySelectorAll('.verse-chip').forEach(function(c) { c.style.color = color; c.style.borderColor = color; });
};

window.setHtml = function(h) {
  if (!h) tiptapEditor.commands.clearContent(false);
  else tiptapEditor.commands.setContent(h, false, { preserveWhitespace: 'full' });
  updatePlaceholder();
};

window.focusEditor = function() { tiptapEditor.commands.focus(); };
window.blurEditor = function() { tiptapEditor.commands.blur(); };

function notifyFormat() {
  sendToApp('FORMAT_STATE', {
    bold: tiptapEditor.isActive('bold'),
    italic: tiptapEditor.isActive('italic'),
    underline: tiptapEditor.isActive('underline'),
    mark: tiptapEditor.isActive('highlight'),
  });
}

function applyFormat(cmd) {
  var hadSel = !tiptapEditor.state.selection.empty;
  var selEnd = tiptapEditor.state.selection.to;
  cmd();
  if (hadSel) {
    var tr = tiptapEditor.state.tr;
    var $pos = tr.doc.resolve(selEnd);
    var TS = tiptapEditor.state.selection.constructor;
    tiptapEditor.view.dispatch(tr.setSelection(TS.near($pos)).setStoredMarks([]));
    notifyFormat();
  } else {
    notifyFormat();
  }
}

window.toggleBold = function() { applyFormat(function() { tiptapEditor.chain().focus().toggleBold().run(); }); };
window.toggleItalic = function() { applyFormat(function() { tiptapEditor.chain().focus().toggleItalic().run(); }); };
window.toggleUnderline = function() { document.execCommand('underline'); notifyFormat(); };

window.toggleMark = function() {
  applyFormat(function() {
    var state = tiptapEditor.state;
    var sel = state.selection;
    if (sel.empty) { tiptapEditor.chain().focus().toggleHighlight().run(); return; }
    var highlightMark = state.schema.marks.highlight;
    if (!highlightMark) { tiptapEditor.chain().focus().toggleHighlight().run(); return; }
    var hasHighlight = false;
    state.doc.nodesBetween(sel.from, sel.to, function(node) {
      if (node.isText && highlightMark.isInSet(node.marks)) hasHighlight = true;
    });
    var tr = state.tr;
    state.doc.nodesBetween(sel.from, sel.to, function(node, pos) {
      if (node.type.name === 'verseChip' || node.type.name === 'sentinela') return false;
      if (!node.isText) return;
      var from = Math.max(pos, sel.from);
      var to = Math.min(pos + node.nodeSize, sel.to);
      if (from >= to) return;
      if (hasHighlight) tr = tr.removeMark(from, to, highlightMark);
      else tr = tr.addMark(from, to, highlightMark.create({ color: null }));
    });
    tiptapEditor.view.dispatch(tr);
  });
};

window.copyText = function() {
  var text = getSelectedText() || getPlainText();
  if (text) sendToApp('COPY_TEXT', { text: text });
};

window.pasteText = function(text) {
  if (!text) return;
  // Verifica se tem chips codificados [[label]]
  if (text.indexOf('[[') !== -1) {
    sendToApp('PASTE_WITH_CHIPS', { text: text });
    return;
  }
  var remaining = MAX_CHARS - countChars();
  if (remaining <= 0) return;
  if (text.length > remaining) text = text.substring(0, remaining);
  tiptapEditor.chain().focus().deleteSelection().insertContent(text).run();
  sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
  updatePlaceholder();
};

window.pasteResolved = function(parts) {
  // parts: array de {type:'text',text:'...'} ou {type:'chip',id:'...',label:'...',accentColor:'...'}
  if (!parts || !parts.length) return;
  tiptapEditor.chain().focus().deleteSelection().run();
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p.type === 'chip') {
      tiptapEditor.chain().focus().insertContent([
        { type: 'verseChip', attrs: { id: p.id, label: p.label, accentColor: p.accentColor || ACCENT } },
        { type: 'sentinela' },
        { type: 'text', text: ' ' },
      ]).run();
    } else if (p.text) {
      tiptapEditor.chain().focus().insertContent(p.text).run();
    }
  }
  sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
  updatePlaceholder();
};

window.deleteBack = function() {
  tiptapEditor.chain().focus().deleteSelection().run();
  sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
  updatePlaceholder();
};

window.clearAll = function() {
  tiptapEditor.commands.clearContent(false);
  sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
  updatePlaceholder();
};

window.insertChip = function(id, label, accentColor) {
  var color = accentColor || ACCENT;
  tiptapEditor.chain().focus().insertContent([
    { type: 'verseChip', attrs: { id: id, label: label, accentColor: color } },
    { type: 'sentinela' },
    { type: 'text', text: ' ' },
  ]).run();
  sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
  updatePlaceholder();
};

window.setMaxChars = function(m) { MAX_CHARS = m; };

function getSelectedText() {
  var state = tiptapEditor.state;
  var sel = state.selection;
  var text = '';
  state.doc.nodesBetween(sel.from, sel.to, function(node, pos) {
    if (node.type.name === 'verseChip') {
      text += '[[' + (node.attrs.label || '') + ']]';
    } else if (node.type.name !== 'sentinela' && node.isText) {
      var s = Math.max(sel.from - pos, 0);
      var e2 = Math.min(sel.to - pos, node.text.length);
      if (e2 > s) text += node.text.slice(s, e2);
    }
  });
  return text;
}

function attachListeners() {
  document.addEventListener('touchstart', function(e) {
    var chip = e.target.closest && e.target.closest('.verse-chip');
    if (chip) {
      proseMirrorEl.setAttribute('inputmode', 'none');
      var id = chip.getAttribute('data-id');
      setTimeout(function() {
        sendToApp('CHIP_PRESS', { id: id });
        setTimeout(function() { proseMirrorEl.setAttribute('inputmode', 'text'); }, 300);
      }, 0);
    }
  }, { passive: true });

  document.addEventListener('click', function(e) {
    var chip = e.target.closest && e.target.closest('.verse-chip');
    if (chip) { e.preventDefault(); e.stopPropagation(); }
  });

  // Backspace sobre verseChip: apaga chip + sentinela/espaço juntos
  proseMirrorEl.addEventListener('beforeinput', function(e) {
    if (e.inputType !== 'deleteContentBackward') return;
    var state = tiptapEditor.state, cur = state.selection.from, doc = state.doc;
    var chipPos = null, chipSize = null;
    doc.nodesBetween(0, cur, function(node, pos) {
      if (node.type.name === 'verseChip') { chipPos = pos; chipSize = node.nodeSize; }
    });
    if (chipPos === null) return;
    var between = '';
    doc.nodesBetween(chipPos + chipSize, cur, function(node) {
      if (node.isText) between += node.text.replace(/ㅤ| /g, '');
    });
    if (between.length > 0) return;
    e.preventDefault();
    tiptapEditor.view.dispatch(state.tr.delete(chipPos, cur));
    sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
    updatePlaceholder();
  });

  // Limite de caracteres
  proseMirrorEl.addEventListener('beforeinput', function(e) {
    try {
      if (!e.inputType || e.inputType.startsWith('delete') || e.inputType.startsWith('format') || e.inputType.startsWith('history')) return;
      var cur = countChars();
      if (e.inputType === 'insertText') {
        if (cur + (e.data || '').length > MAX_CHARS) { e.preventDefault(); return; }
      }
      if (e.inputType === 'insertCompositionText' && cur >= MAX_CHARS) { e.preventDefault(); return; }
      if (e.inputType.startsWith('insert') && e.inputType !== 'insertText' && e.inputType !== 'insertCompositionText') {
        if (cur >= MAX_CHARS) { e.preventDefault(); return; }
      }
    } catch(e2) {}
  });

  // Capitalização automática após . ! ?
  proseMirrorEl.addEventListener('beforeinput', function(e) {
    if (e.inputType !== 'insertText') return;
    var char = e.data;
    if (!char || !/^[a-zà-ÿ]$/.test(char)) return;
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    var range = sel.getRangeAt(0);
    var container = range.startContainer, offset = range.startOffset;
    var textBefore = '';
    if (container.nodeType === 3) textBefore = container.textContent.substring(Math.max(0, offset - 10), offset);
    if (/[.!?]+\s+$/.test(textBefore)) {
      e.preventDefault();
      document.execCommand('insertText', false, char.toUpperCase());
    }
  });

  tiptapEditor.on('selectionUpdate', notifyFormat);
  proseMirrorEl.addEventListener('touchend', function() { setTimeout(notifyFormat, 80); });

  // Copy: serializa seleção corretamente, colapsa cursor para o fim após copiar
  document.addEventListener('copy', function(e) {
    e.stopImmediatePropagation();
    var text = getSelectedText();
    var selTo = tiptapEditor.state.selection.to;
    var selEmpty = tiptapEditor.state.selection.empty;
    setTimeout(function() {
      if (!selEmpty) tiptapEditor.commands.setTextSelection(selTo);
    }, 0);
    if (!text) {
      var sel = window.getSelection();
      if (sel && sel.toString()) text = sel.toString();
    }
    if (!text) text = getPlainText();
    if (!text) return;
    sendToApp('COPY_TEXT', { text: text });
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', text);
      e.clipboardData.setData('text/html', '');
      e.preventDefault();
    }
  }, true);

  // Cut: copia seleção, apaga, limpa se sobrar só sentinela/espaço
  document.addEventListener('cut', function(e) {
    e.stopImmediatePropagation();
    var text = getSelectedText();
    if (!text) return;
    e.preventDefault();
    if (e.clipboardData) { e.clipboardData.setData('text/plain', text); e.clipboardData.setData('text/html', ''); }
    sendToApp('COPY_TEXT', { text: text });
    tiptapEditor.chain().focus().deleteSelection().run();
    var afterState = tiptapEditor.state;
    var hasRealContent = false;
    afterState.doc.descendants(function(node) {
      if (node.type.name === 'verseChip') { hasRealContent = true; return false; }
      if (node.isText && node.text.replace(/[ㅤ ]/g, '').length > 0) { hasRealContent = true; return false; }
    });
    if (!hasRealContent) tiptapEditor.commands.clearContent(false);
    sendToApp('CHANGE', { html: getFullHtml(), text: getPlainText(), charCount: countChars() });
    updatePlaceholder();
  }, true);
}
`;

const css = [
  '*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}',
  'html,body{height:100%;width:100%;background:#0F0F0F;font-family:sans-serif;color:#FFFFFF;overflow:hidden;}',
  '#editor-container{width:100%;height:100%;position:relative;}',
  '.ProseMirror{width:100%;min-height:100%;padding:20px;font-size:16px;line-height:26px;color:#FFFFFF;outline:none;border:none;overflow-y:auto;-webkit-overflow-scrolling:touch;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere;word-break:break-word;}',
  '.ProseMirror.is-empty:before{content:attr(data-placeholder);color:#555;pointer-events:none;display:block;position:absolute;top:20px;left:20px;}',
  'strong{font-weight:bold;}',
  'em{font-style:italic;}',
  'u{text-decoration:underline;}',
  '.verse-chip{display:inline-block;vertical-align:middle;margin:0 2px;cursor:pointer;user-select:none;-webkit-user-select:none;padding:1px 8px;border-radius:6px;background:#242424;border:none;font-size:12px;font-weight:700;line-height:22px;white-space:nowrap;}',
  '.sentinela-anti-caps{font-size:0!important;line-height:0!important;width:0!important;height:0!important;opacity:0!important;overflow:hidden!important;pointer-events:none!important;display:inline!important;user-select:text!important;-webkit-user-select:text!important;}',
  'mark.destaque,span.destaque{background-color:#FFD600;color:#000;border-radius:2px;padding:0 2px;}',
].join('');

const html = '<!DOCTYPE html>\n<html>\n<head>\n' +
  '<meta charset="UTF-8"/>\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>\n' +
  '<style>' + css + '</style>\n' +
  '</head>\n<body>\n' +
  '<div id="editor-container"></div>\n' +
  '<script>' + bundle + '<' + '/script>\n' +
  '<script>' + editorScript + '<' + '/script>\n' +
  '</body>\n</html>';

const output = `// GERADO por buildEditorHtml.js — não editar manualmente\nexport const editorHtml = ${JSON.stringify(html)};\n`;

fs.writeFileSync(path.join(__dirname, 'editorHtml.js'), output);
console.log('ok —', Math.round(JSON.stringify(html).length / 1024) + 'KB');
