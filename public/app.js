/**
 * Email Subject Triage AI - Frontend Application
 * Handles input, imports, AI analysis, search, downloads, and theme management.
 */

(function () {
  'use strict';

  /* =========================================================================
     Constants
     ========================================================================= */
  var STORAGE_KEYS = {
    theme: 'triage-ai-theme',
    subjects: 'triage-ai-subjects',
    result: 'triage-ai-result',
  };

  var CATEGORY_COLORS = {
    urgent: '#ef4444',
    work: '#3b82f6',
    newsletters: '#8b5cf6',
    notifications: '#6366f1',
    personal: '#10b981',
    finance: '#f59e0b',
    shopping: '#ec4899',
    travel: '#14b8a6',
    security: '#ef4444',
    promotions: '#f97316',
    updates: '#06b6d4',
    other: '#64748b',
  };

  var FALLBACK_COLORS = ['#8b5cf6', '#d946ef', '#a855f7', '#7c3aed', '#c084fc'];

  var EXAMPLE_SUBJECTS = [
    'Weekly Report',
    'Invoice #5521',
    'Security Alert',
    'Password Reset',
    'Your Amazon Order Has Shipped',
    'Meeting Tomorrow at 3pm',
    'GitHub: New pull request on repo',
    'New login detected from Chrome on Windows',
    'Newsletter: Top 10 productivity tips',
    '50% Off - Summer Sale ends tonight',
    'Package Delivered - FedEx',
    'Your flight confirmation: NYC to LAX',
    'Re: Q3 Budget Review',
    'Welcome to Slack',
    'Your subscription is expiring',
    'Flight delay notification',
    'Team standup notes',
    'Unsubscribe from marketing emails',
    'New comment on your document',
    'Action Required: Sign the contract',
  ];

  /* =========================================================================
     DOM References
     ========================================================================= */
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var dom = {
    themeToggle: $('#theme-toggle'),
    subjectInput: $('#subject-input'),
    inputCount: $('#input-count'),
    dropZone: $('#drop-zone'),
    fileInput: $('#file-input'),
    btnAnalyze: $('#btn-analyze'),
    btnClear: $('#btn-clear'),
    btnGenerateInbox: $('#btn-generate-inbox'),
    btnExample: $('#btn-example'),
    btnImportTxt: $('#btn-import-txt'),
    btnImportCsv: $('#btn-import-csv'),
    btnImportJson: $('#btn-import-json'),
    emptyState: $('#empty-state'),
    resultsContainer: $('#results-container'),
    summaryText: $('#summary-text'),
    btnCollapseAll: $('#btn-collapse-all'),
    btnExpandAll: $('#btn-expand-all'),
    statTotal: $('#stat-total'),
    statCategories: $('#stat-categories'),
    statLargest: $('#stat-largest'),
    statTime: $('#stat-time'),
    searchInput: $('#search-input'),
    searchClear: $('#search-clear'),
    categoriesContainer: $('#categories-container'),
    btnToggleJson: $('#btn-toggle-json'),
    btnCopyJson: $('#btn-copy-json'),
    jsonOutput: $('#json-output'),
    btnDownloadJson: $('#btn-download-json'),
    btnDownloadTxt: $('#btn-download-txt'),
    btnDownloadCsv: $('#btn-download-csv'),
    btnDownloadMd: $('#btn-download-md'),
    loadingOverlay: $('#loading-overlay'),
    loaderSubjectCount: $('#loader-subject-count'),
    toastContainer: $('#toast-container'),
    tabAnalyze: $('#tab-analyze'),
    tabGenerate: $('#tab-generate'),
    analyzeContent: $('#analyze-content'),
    generateContent: $('#generate-content'),
    genTopic: $('#gen-topic'),
    genCount: $('#gen-count'),
    genTone: $('#gen-tone'),
    btnGenerate: $('#btn-generate'),
  };

  /* =========================================================================
     State
     ========================================================================= */
  var lastResult = null;

  /* =========================================================================
     Theme
     ========================================================================= */
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

  /* =========================================================================
     Toast Notifications
     ========================================================================= */
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

  /* =========================================================================
     Utilities
     ========================================================================= */
  function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  function parseSubjects(text) {
    return text
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.length > 0; });
  }

  function updateInputCount() {
    var subjects = parseSubjects(dom.subjectInput.value);
    dom.inputCount.textContent = subjects.length + ' subject' + (subjects.length !== 1 ? 's' : '');
  }

  function showResults() {
    dom.emptyState.style.display = 'none';
    dom.resultsContainer.style.display = 'block';
  }

  function hideResults() {
    dom.emptyState.style.display = 'flex';
    dom.resultsContainer.style.display = 'none';
  }

  /* =========================================================================
     Loading
     ========================================================================= */
  function showLoading(count) {
    dom.loaderSubjectCount.textContent = count + ' subject' + (count !== 1 ? 's' : '') + ' to analyze';
    dom.loadingOverlay.setAttribute('aria-hidden', 'false');
    setButtonsDisabled(true);
  }

  function hideLoading() {
    dom.loadingOverlay.setAttribute('aria-hidden', 'true');
    setButtonsDisabled(false);
  }

  function setButtonsDisabled(disabled) {
    dom.btnAnalyze.disabled = disabled;
    dom.btnClear.disabled = disabled;
    dom.btnExample.disabled = disabled;
  }

  /* =========================================================================
     API
     ========================================================================= */
  async function analyzeSubjects() {
    var text = dom.subjectInput.value.trim();
    if (!text) {
      showToast('Please paste some email subjects first.', 'warning');
      dom.subjectInput.focus();
      return;
    }

    var subjects = parseSubjects(text);
    if (subjects.length === 0) {
      showToast('No valid subjects found.', 'warning');
      return;
    }

    if (subjects.length > 2000) {
      showToast('Maximum 2000 subjects allowed. You have ' + subjects.length + '.', 'warning');
      return;
    }

    showLoading(subjects.length);
    var startTime = performance.now();

    try {
      var response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjects: subjects }),
      });

      var result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Analysis failed');
      }

      var elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      result._time = elapsed;
      result._count = subjects.length;

      lastResult = result;
      localStorage.setItem(STORAGE_KEYS.result, JSON.stringify(result));
      localStorage.setItem(STORAGE_KEYS.subjects, text);

      renderResults(result);
      showResults();
      showToast('Analysis complete! ' + (result.categories ? result.categories.length : 0) + ' categories found.', 'success');
    } catch (err) {
      showToast(err.message || 'An error occurred during analysis.', 'error');
    } finally {
      hideLoading();
    }
  }

  /* =========================================================================
     Render Results
     ========================================================================= */
  function renderResults(result) {
    // Summary
    dom.summaryText.textContent = result.summary || 'No summary available.';

    // Stats
    var categories = result.categories || [];
    var totalCount = result._count || result.count || 0;
    var largestName = '-';
    var largestCount = 0;

    categories.forEach(function (cat) {
      if (cat.subjects && cat.subjects.length > largestCount) {
        largestCount = cat.subjects.length;
        largestName = cat.name;
      }
    });

    dom.statTotal.textContent = totalCount;
    dom.statCategories.textContent = categories.length;
    dom.statLargest.textContent = largestName + (largestCount > 0 ? ' (' + largestCount + ')' : '');
    dom.statTime.textContent = (result._time || '-') + (result._time ? 's' : '');

    // JSON preview
    var cleanResult = {
      summary: result.summary,
      categories: categories.map(function (c) {
        return { name: c.name, subjects: c.subjects };
      }),
    };
    dom.jsonOutput.textContent = JSON.stringify(cleanResult, null, 2);

    // Categories
    renderCategories(categories);
  }

  function renderCategories(categories) {
    dom.categoriesContainer.innerHTML = '';

    categories.forEach(function (cat, index) {
      var color = CATEGORY_COLORS[cat.name.toLowerCase()] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
      var subjects = cat.subjects || [];

      var card = document.createElement('div');
      card.className = 'category-card';
      card.setAttribute('data-category', cat.name.toLowerCase());

      card.innerHTML =
        '<div class="category-header" role="button" tabindex="0" aria-expanded="true">' +
          '<div class="category-title-group">' +
            '<span class="category-dot" style="background:' + color + '"></span>' +
            '<span class="category-name">' + escapeHtml(cat.name) + '</span>' +
            '<span class="category-count">' + subjects.length + '</span>' +
          '</div>' +
          '<svg class="category-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
        '<div class="category-body">' +
          '<ul class="subject-list">' +
            subjects.map(function (s) {
              return '<li class="subject-item">' + escapeHtml(s) + '</li>';
            }).join('') +
          '</ul>' +
        '</div>';

      // Toggle collapse
      var header = card.querySelector('.category-header');
      header.addEventListener('click', function () {
        card.classList.toggle('collapsed');
        header.setAttribute('aria-expanded', String(!card.classList.contains('collapsed')));
      });
      header.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });

      dom.categoriesContainer.appendChild(card);
    });
  }

  /* =========================================================================
     Search
     ========================================================================= */
  function filterCategories(query) {
    var cards = dom.categoriesContainer.querySelectorAll('.category-card');
    var lowerQuery = query.toLowerCase().trim();

    cards.forEach(function (card) {
      if (!lowerQuery) {
        card.style.display = '';
        card.querySelectorAll('.subject-item').forEach(function (item) {
          item.classList.remove('hidden');
        });
        return;
      }

      var catName = card.getAttribute('data-category');
      var nameMatch = catName.indexOf(lowerQuery) !== -1;
      var anySubjectMatch = false;

      card.querySelectorAll('.subject-item').forEach(function (item) {
        var text = item.textContent.toLowerCase();
        if (text.indexOf(lowerQuery) !== -1) {
          item.classList.remove('hidden');
          anySubjectMatch = true;
        } else {
          item.classList.add('hidden');
        }
      });

      card.style.display = (nameMatch || anySubjectMatch) ? '' : 'none';
    });
  }

  /* =========================================================================
     Import Handlers
     ========================================================================= */
  function handleFileImport(file, format) {
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      var content = e.target.result;
      var subjects = [];

      try {
        if (format === 'json') {
          var parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            subjects = parsed.map(function (item) {
              return typeof item === 'string' ? item : (item.subject || item.title || String(item));
            });
          } else if (parsed.subjects && Array.isArray(parsed.subjects)) {
            subjects = parsed.subjects;
          } else if (parsed.emails && Array.isArray(parsed.emails)) {
            subjects = parsed.emails.map(function (item) {
              return typeof item === 'string' ? item : (item.subject || item.title || String(item));
            });
          } else {
            throw new Error('Unrecognized JSON structure. Expected an array of strings or { "subjects": [...] }');
          }
        } else if (format === 'csv') {
          var lines = content.split(/\r?\n/);
          // Check if first line is a header
          var firstLine = lines[0].toLowerCase();
          var startIdx = 0;
          if (firstLine.indexOf('subject') !== -1 || firstLine.indexOf('email') !== -1 || firstLine.indexOf('title') !== -1) {
            startIdx = 1;
          }
          for (var i = startIdx; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            // Handle quoted CSV
            if (line.charAt(0) === '"') {
              var match = line.match(/^"([^"]*)"/);
              if (match) {
                subjects.push(match[1]);
                continue;
              }
            }
            // Simple: take first column
            var parts = line.split(',');
            subjects.push(parts[0].trim());
          }
        } else {
          // TXT: one subject per line
          subjects = content.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
        }
      } catch (err) {
        showToast('Failed to parse file: ' + err.message, 'error');
        return;
      }

      if (subjects.length === 0) {
        showToast('No subjects found in the file.', 'warning');
        return;
      }

      // Append to existing or replace
      var existing = dom.subjectInput.value.trim();
      var newSubjects;
      if (existing) {
        newSubjects = existing + '\n' + subjects.join('\n');
      } else {
        newSubjects = subjects.join('\n');
      }
      dom.subjectInput.value = newSubjects;
      updateInputCount();
      localStorage.setItem(STORAGE_KEYS.subjects, newSubjects);
      showToast('Imported ' + subjects.length + ' subject' + (subjects.length !== 1 ? 's' : '') + ' from ' + format.toUpperCase(), 'success');
    };

    reader.readAsText(file);
  }

  function triggerFileImport(format) {
    var acceptMap = {
      txt: '.txt',
      csv: '.csv',
      json: '.json',
    };
    dom.fileInput.accept = acceptMap[format] || '*';
    dom.fileInput.dataset.format = format;
    dom.fileInput.click();
  }

  /* =========================================================================
     Downloads
     ========================================================================= */
  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getCleanResult() {
    if (!lastResult) return null;
    return {
      summary: lastResult.summary,
      categories: (lastResult.categories || []).map(function (c) {
        return { name: c.name, subjects: c.subjects };
      }),
    };
  }

  function downloadJson() {
    var result = getCleanResult();
    if (!result) { showToast('No results to download.', 'warning'); return; }
    downloadFile(JSON.stringify(result, null, 2), 'triage-results.json', 'application/json');
    showToast('Downloaded JSON', 'success');
  }

  function downloadTxt() {
    var result = getCleanResult();
    if (!result) { showToast('No results to download.', 'warning'); return; }
    var lines = ['Email Subject Triage Results', '============================', '', 'Summary: ' + result.summary, ''];
    (result.categories || []).forEach(function (cat) {
      lines.push('[' + cat.name + '] (' + cat.subjects.length + ')');
      cat.subjects.forEach(function (s) { lines.push('  - ' + s); });
      lines.push('');
    });
    downloadFile(lines.join('\n'), 'triage-results.txt', 'text/plain');
    showToast('Downloaded TXT', 'success');
  }

  function downloadCsv() {
    var result = getCleanResult();
    if (!result) { showToast('No results to download.', 'warning'); return; }
    var lines = ['Category', 'Subject'];
    (result.categories || []).forEach(function (cat) {
      cat.subjects.forEach(function (s) {
        lines.push('"' + cat.name.replace(/"/g, '""') + '","' + s.replace(/"/g, '""') + '"');
      });
    });
    downloadFile(lines.join('\n'), 'triage-results.csv', 'text/csv');
    showToast('Downloaded CSV', 'success');
  }

  function downloadMarkdown() {
    var result = getCleanResult();
    if (!result) { showToast('No results to download.', 'warning'); return; }
    var lines = ['# Email Subject Triage Results', '', '## Summary', '', result.summary, ''];
    (result.categories || []).forEach(function (cat) {
      lines.push('## ' + cat.name + ' (' + cat.subjects.length + ')', '');
      cat.subjects.forEach(function (s) { lines.push('- ' + s); });
      lines.push('');
    });
    downloadFile(lines.join('\n'), 'triage-results.md', 'text/markdown');
    showToast('Downloaded Markdown', 'success');
  }

  /* =========================================================================
     Clear
     ========================================================================= */
  function clearAll() {
    dom.subjectInput.value = '';
    updateInputCount();
    lastResult = null;
    hideResults();
    localStorage.removeItem(STORAGE_KEYS.result);
    localStorage.removeItem(STORAGE_KEYS.subjects);
    dom.searchInput.value = '';
    dom.searchClear.style.display = 'none';
    showToast('Cleared', 'info');
  }

  /* =========================================================================
     Load Example
     ========================================================================= */
  function loadExample() {
    dom.subjectInput.value = EXAMPLE_SUBJECTS.join('\n');
    updateInputCount();
    localStorage.setItem(STORAGE_KEYS.subjects, dom.subjectInput.value);
    showToast('Loaded ' + EXAMPLE_SUBJECTS.length + ' example subjects', 'success');
  }

  /* =========================================================================
     Mode Tabs
     ========================================================================= */
  function switchMode(mode) {
    dom.tabAnalyze.classList.toggle('active', mode === 'analyze');
    dom.tabGenerate.classList.toggle('active', mode === 'generate');
    dom.tabAnalyze.setAttribute('aria-selected', mode === 'analyze');
    dom.tabGenerate.setAttribute('aria-selected', mode === 'generate');
    dom.analyzeContent.style.display = mode === 'analyze' ? '' : 'none';
    dom.generateContent.style.display = mode === 'generate' ? '' : 'none';
  }

  /* =========================================================================
     Generate Subjects
     ========================================================================= */
  async function generateSubjects() {
    var topic = dom.genTopic.value.trim();
    if (!topic) {
      showToast('Please enter a topic.', 'warning');
      dom.genTopic.focus();
      return;
    }

    var count = parseInt(dom.genCount.value, 10) || 5;
    var tone = dom.genTone.value;

    dom.btnGenerate.disabled = true;
    dom.btnGenerate.textContent = 'Generating...';

    try {
      var response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic, count: count, tone: tone }),
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

      // Switch to analyze mode
      switchMode('analyze');
      dom.btnAnalyze.focus();
    } catch (err) {
      showToast(err.message || 'Generation failed.', 'error');
    } finally {
      dom.btnGenerate.disabled = false;
      dom.btnGenerate.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><path d="M6 6l12 12M18 6l-12 12"/></svg> Generate Subjects';
    }
  }

  /* =========================================================================
     Generate Inbox (50 subjects)
     ========================================================================= */
  async function generateInbox() {
    dom.btnGenerateInbox.disabled = true;
    dom.btnGenerateInbox.textContent = 'Generating...';

    try {
      var response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'realistic Gmail inbox: work emails, newsletters, promotions, notifications, security alerts, social media, receipts, travel confirmations, meeting invites',
          count: 50,
          tone: 'professional',
        }),
      });

      var result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || result.error || 'Generation failed');
      }

      var subjects = result.subjects || [];
      if (subjects.length === 0) {
        showToast('No subjects generated. Try again.', 'warning');
        return;
      }

      dom.subjectInput.value = subjects.join('\n');
      updateInputCount();
      localStorage.setItem(STORAGE_KEYS.subjects, dom.subjectInput.value);
      showToast('Generated ' + subjects.length + ' inbox subjects', 'success');
    } catch (err) {
      showToast(err.message || 'Generation failed.', 'error');
    } finally {
      dom.btnGenerateInbox.disabled = false;
      dom.btnGenerateInbox.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><path d="M6 6l12 12M18 6l-12 12"/></svg> Generate Inbox (50)';
    }
  }

  /* =========================================================================
     Restore from localStorage
     ========================================================================= */
  function restoreState() {
    var savedSubjects = localStorage.getItem(STORAGE_KEYS.subjects);
    if (savedSubjects) {
      dom.subjectInput.value = savedSubjects;
      updateInputCount();
    }

    var savedResult = localStorage.getItem(STORAGE_KEYS.result);
    if (savedResult) {
      try {
        lastResult = JSON.parse(savedResult);
        renderResults(lastResult);
        showResults();
      } catch (e) {
        localStorage.removeItem(STORAGE_KEYS.result);
      }
    }
  }

  /* =========================================================================
     Event Binding
     ========================================================================= */
  function bindEvents() {
    // Theme
    dom.themeToggle.addEventListener('click', toggleTheme);

    // Input count
    dom.subjectInput.addEventListener('input', function () {
      updateInputCount();
      localStorage.setItem(STORAGE_KEYS.subjects, this.value);
    });

    // Buttons
    dom.btnAnalyze.addEventListener('click', analyzeSubjects);
    dom.btnClear.addEventListener('click', clearAll);
    dom.btnGenerateInbox.addEventListener('click', generateInbox);
    dom.btnExample.addEventListener('click', loadExample);

    // Mode tabs
    dom.tabAnalyze.addEventListener('click', function () { switchMode('analyze'); });
    dom.tabGenerate.addEventListener('click', function () { switchMode('generate'); });

    // Generate
    dom.btnGenerate.addEventListener('click', generateSubjects);
    dom.genTopic.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        generateSubjects();
      }
    });

    // Import buttons
    dom.btnImportTxt.addEventListener('click', function () { triggerFileImport('txt'); });
    dom.btnImportCsv.addEventListener('click', function () { triggerFileImport('csv'); });
    dom.btnImportJson.addEventListener('click', function () { triggerFileImport('json'); });

    // File input change
    dom.fileInput.addEventListener('change', function () {
      var format = this.dataset.format || 'txt';
      if (this.files && this.files.length > 0) {
        handleFileImport(this.files[0], format);
      }
      this.value = '';
    });

    // Drop zone
    dom.dropZone.addEventListener('click', function () {
      dom.fileInput.accept = '.txt,.csv,.json';
      dom.fileInput.dataset.format = '';
      dom.fileInput.click();
    });

    dom.dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      this.classList.add('drag-over');
    });

    dom.dropZone.addEventListener('dragleave', function () {
      this.classList.remove('drag-over');
    });

    dom.dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      this.classList.remove('drag-over');
      var files = e.dataTransfer.files;
      if (files.length > 0) {
        var file = files[0];
        var name = file.name.toLowerCase();
        var format = 'txt';
        if (name.endsWith('.csv')) format = 'csv';
        else if (name.endsWith('.json')) format = 'json';
        handleFileImport(file, format);
      }
    });

    // Also allow drop on textarea
    dom.subjectInput.addEventListener('dragover', function (e) {
      e.preventDefault();
      dom.dropZone.classList.add('drag-over');
    });

    dom.subjectInput.addEventListener('dragleave', function () {
      dom.dropZone.classList.remove('drag-over');
    });

    dom.subjectInput.addEventListener('drop', function (e) {
      e.preventDefault();
      dom.dropZone.classList.remove('drag-over');
      var files = e.dataTransfer.files;
      if (files.length > 0) {
        var file = files[0];
        var name = file.name.toLowerCase();
        var format = 'txt';
        if (name.endsWith('.csv')) format = 'csv';
        else if (name.endsWith('.json')) format = 'json';
        handleFileImport(file, format);
      }
    });

    // Search
    dom.searchInput.addEventListener('input', function () {
      var val = this.value;
      filterCategories(val);
      dom.searchClear.style.display = val ? 'flex' : 'none';
    });

    dom.searchClear.addEventListener('click', function () {
      dom.searchInput.value = '';
      filterCategories('');
      dom.searchClear.style.display = 'none';
      dom.searchInput.focus();
    });

    // Collapse / Expand all
    dom.btnCollapseAll.addEventListener('click', function () {
      dom.categoriesContainer.querySelectorAll('.category-card').forEach(function (card) {
        card.classList.add('collapsed');
        card.querySelector('.category-header').setAttribute('aria-expanded', 'false');
      });
    });

    dom.btnExpandAll.addEventListener('click', function () {
      dom.categoriesContainer.querySelectorAll('.category-card').forEach(function (card) {
        card.classList.remove('collapsed');
        card.querySelector('.category-header').setAttribute('aria-expanded', 'true');
      });
    });

    // JSON toggle
    dom.btnToggleJson.addEventListener('click', function () {
      var visible = dom.jsonOutput.style.display !== 'none';
      dom.jsonOutput.style.display = visible ? 'none' : 'block';
      this.textContent = visible ? 'Show' : 'Hide';
    });

    // Copy JSON
    dom.btnCopyJson.addEventListener('click', function () {
      var text = dom.jsonOutput.textContent;
      if (!text) return;
      navigator.clipboard.writeText(text).then(function () {
        showToast('JSON copied to clipboard', 'success');
      }).catch(function () {
        showToast('Failed to copy', 'error');
      });
    });

    // Downloads
    dom.btnDownloadJson.addEventListener('click', downloadJson);
    dom.btnDownloadTxt.addEventListener('click', downloadTxt);
    dom.btnDownloadCsv.addEventListener('click', downloadCsv);
    dom.btnDownloadMd.addEventListener('click', downloadMarkdown);

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      // Ctrl+Enter = Analyze
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        analyzeSubjects();
      }
      // Ctrl+D = Toggle theme
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
      }
      // Escape = Clear search
      if (e.key === 'Escape' && document.activeElement === dom.searchInput) {
        dom.searchInput.value = '';
        filterCategories('');
        dom.searchClear.style.display = 'none';
      }
    });

    // Drop zone keyboard
    dom.dropZone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
  }

  /* =========================================================================
     Initialization
     ========================================================================= */
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
