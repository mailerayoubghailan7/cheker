(function () {
  'use strict';

  var STORAGE_KEYS = {
    theme: 'gen-ai-theme',
    subjects: 'gen-ai-subjects',
  };

  var $ = function (sel) { return document.querySelector(sel); };

  var dom = {
    themeToggle: $('#theme-toggle'),
    subjectInput: $('#subject-input'),
    inputCount: $('#input-count'),
    genTopic: $('#gen-topic'),
    genCount: $('#gen-count'),
    genTone: $('#gen-tone'),
    genLength: $('#gen-length'),
    genEmoji: $('#gen-emoji'),
    btnGenerate: $('#btn-generate'),
    btnCopy: $('#btn-copy'),
    btnDownload: $('#btn-download'),
    btnClear: $('#btn-clear'),
    loadingOverlay: $('#loading-overlay'),
    toastContainer: $('#toast-container'),
  };

  function getPreferredTheme() {
    var stored = localStorage.getItem(STORAGE_KEYS.theme);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  function showToast(message, type) {
    type = type || 'info';
    var icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    };

    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<span class="toast-icon">' + icons[type] + '</span><span>' + escapeHtml(message) + '</span>';
    dom.toastContainer.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('removing');
      toast.addEventListener('animationend', function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      });
    }, 3500);
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  function updateInputCount() {
    var subjects = dom.subjectInput.value.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    dom.inputCount.textContent = subjects.length + ' subject' + (subjects.length !== 1 ? 's' : '');
  }

  function showLoading() {
    dom.loadingOverlay.setAttribute('aria-hidden', 'false');
    dom.btnGenerate.disabled = true;
  }

  function hideLoading() {
    dom.loadingOverlay.setAttribute('aria-hidden', 'true');
    dom.btnGenerate.disabled = false;
  }

  async function generateSubjects() {
    var topic = dom.genTopic.value.trim();
    if (!topic) {
      showToast('Please enter a topic.', 'warning');
      dom.genTopic.focus();
      return;
    }

    var count = parseInt(dom.genCount.value, 10) || 10;
    var tone = dom.genTone.value;
    var length = dom.genLength.value;
    var emoji = dom.genEmoji.checked;

    showLoading();

    try {
      var response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, count: count, tone: tone, length: length, emoji: emoji }),
      });

      var result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Generation failed');
      }

      var subjects = result.subjects || [];
      if (subjects.length === 0) {
        showToast('No subjects generated. Try a different topic.', 'warning');
        return;
      }

      dom.subjectInput.value = subjects.join('\n');
      updateInputCount();
      localStorage.setItem(STORAGE_KEYS.subjects, dom.subjectInput.value);
      showToast('Generated ' + subjects.length + ' subject' + (subjects.length !== 1 ? 's' : ''), 'success');
    } catch (err) {
      showToast(err.message || 'Generation failed.', 'error');
    } finally {
      hideLoading();
    }
  }

  function copyText() {
    var text = dom.subjectInput.value.trim();
    if (!text) { showToast('Nothing to copy.', 'warning'); return; }
    navigator.clipboard.writeText(text).then(function () {
      showToast('Copied to clipboard', 'success');
    }).catch(function () {
      showToast('Failed to copy', 'error');
    });
  }

  function downloadText() {
    var text = dom.subjectInput.value.trim();
    if (!text) { showToast('Nothing to download.', 'warning'); return; }
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'generated-subjects.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    dom.subjectInput.value = '';
    updateInputCount();
    localStorage.removeItem(STORAGE_KEYS.subjects);
    showToast('Cleared', 'info');
  }

  function restoreState() {
    var saved = localStorage.getItem(STORAGE_KEYS.subjects);
    if (saved) {
      dom.subjectInput.value = saved;
      updateInputCount();
    }
  }

  function bindEvents() {
    dom.themeToggle.addEventListener('click', toggleTheme);

    dom.subjectInput.addEventListener('input', function () {
      updateInputCount();
      localStorage.setItem(STORAGE_KEYS.subjects, this.value);
    });

    dom.btnGenerate.addEventListener('click', generateSubjects);
    dom.btnCopy.addEventListener('click', copyText);
    dom.btnDownload.addEventListener('click', downloadText);
    dom.btnClear.addEventListener('click', clearAll);

    dom.genTopic.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        generateSubjects();
      }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        generateSubjects();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
    });
  }

  function init() {
    setTheme(getPreferredTheme());
    bindEvents();
    updateInputCount();
    restoreState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
