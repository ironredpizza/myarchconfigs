// ==UserScript==
// @name         HC-35 Gmail PDF Auto-Downloader
// @namespace    http://tampermonkey.net/
// @version      4.5
// @description  Downloads HC-35 PDFs from Gmail. Single-thread and batch modes. Batch supports date range filtering and full pagination.
// @author       You
// @match        https://mail.google.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      mail-attachment.googleusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  // ─── Name Bank ───────────────────────────────────────────────────────────────
  const NAME_BANK = [
    'AZRIE', 'NORVIN', 'ZILHAN', 'ISHAAN', 'SYAQIL', 'RYAN CHONG',
    'WENXUAN', 'RONALD', 'KHALIS', 'ZHUOLIN', 'KENNETH', 'TAURIQ',
    'JOSHUA', 'JUN YI', 'AZYRFAN', 'DYLAN', 'KEYAN', 'SEAN', 'AJEY',
    'KRIS', 'TOBY', 'HONG MING',
    // Add more names below this line:
    'PANG ZHENG KAI RYAN', 'AZY', 'RYAN SIAH', 'JARVIS', 'THADDEUS', 'TENG FONG',
  ];

  const NAME_BANK_SORTED = NAME_BANK
    .map(function(n) { return n.trim().toUpperCase(); })
    .sort(function(a, b) { return b.length - a.length; });

  const MONTHS = {
    jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
    jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12',
  };

  // ── Styles ────────────────────────────────────────────────────────────────────
  GM_addStyle([
    '#hc35-btn, #hc35-batch-btn {',
    '  position:fixed; right:24px; z-index:2147483647;',
    '  color:#fff; border:none; border-radius:8px;',
    '  padding:10px 18px; font-size:14px;',
    "  font-family:'Google Sans',Roboto,sans-serif;",
    '  cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.3);',
    '  transition:background 0.2s,opacity 0.2s;',
    '  min-width:220px; text-align:left;',
    '}',
    '#hc35-btn { bottom:24px; background:#1a73e8; }',
    '#hc35-btn:hover    { background:#1558b0; }',
    '#hc35-btn:disabled { background:#888; cursor:wait; }',
    '#hc35-batch-btn { bottom:70px; background:#188038; }',
    '#hc35-batch-btn:hover    { background:#0d6127; }',
    '#hc35-batch-btn:disabled { opacity:0.8; cursor:wait; }',
    '#hc35-batch-btn.hc35-done  { background:#0d6127 !important; cursor:default; }',
    '#hc35-batch-btn.hc35-error { background:#c5221f !important; cursor:default; }',
    '#hc35-batch-btn .hc35-bar {',
    '  display:inline-block; width:72px; height:5px;',
    '  background:rgba(255,255,255,0.3); border-radius:3px;',
    '  vertical-align:middle; margin-left:8px; overflow:hidden;',
    '}',
    '#hc35-batch-btn .hc35-fill {',
    '  height:100%; width:0%; background:#fff;',
    '  border-radius:3px; transition:width 0.3s ease;',
    '}',
    /* ── date picker panel ── */
    '#hc35-date-panel {',
    '  position:fixed; right:24px; bottom:118px; z-index:2147483647;',
    '  background:#fff; border:1px solid #dadce0; border-radius:10px;',
    '  padding:14px 16px 12px; box-shadow:0 4px 16px rgba(0,0,0,0.18);',
    "  font-family:'Google Sans',Roboto,sans-serif; font-size:13px; color:#202124;",
    '  display:none; min-width:230px;',
    '}',
    '#hc35-date-panel label { display:block; margin-bottom:3px; font-weight:500; color:#5f6368; font-size:11.5px; }',
    '#hc35-date-panel input[type=date] {',
    '  width:100%; box-sizing:border-box; padding:6px 8px; border:1px solid #dadce0;',
    '  border-radius:6px; font-size:13px; color:#202124; margin-bottom:10px;',
    '  outline:none; cursor:pointer;',
    '}',
    '#hc35-date-panel input[type=date]:focus { border-color:#1a73e8; }',
    '#hc35-date-go {',
    '  width:100%; padding:8px; background:#188038; color:#fff; border:none;',
    '  border-radius:6px; font-size:13px; cursor:pointer;',
    "  font-family:'Google Sans',Roboto,sans-serif; font-weight:500;",
    '}',
    '#hc35-date-go:hover { background:#0d6127; }',
    /* ── log panel ── */
    '#hc35-status {',
    '  position:fixed; right:24px; z-index:2147483647;',
    '  background:#fff; border:1px solid #dadce0; border-radius:8px;',
    '  padding:12px 16px; font-size:12.5px;',
    "  font-family:'Google Sans',Roboto,sans-serif;",
    '  max-width:380px; max-height:260px; overflow-y:auto;',
    '  box-shadow:0 2px 10px rgba(0,0,0,0.18);',
    '  display:none; white-space:pre-wrap; word-break:break-word;',
    '  bottom:310px;',
    '}',
  ].join('\n'));

  // ── UI injection ──────────────────────────────────────────────────────────────
  function injectUI() {
    if (document.getElementById('hc35-btn')) return;

    // Log panel
    var status = document.createElement('div');
    status.id = 'hc35-status';
    document.body.appendChild(status);

    // ── Date picker panel ──
    var panel = document.createElement('div');
    panel.id = 'hc35-date-panel';

    var fromLabel = document.createElement('label');
    fromLabel.textContent = 'FROM DATE';
    panel.appendChild(fromLabel);

    var fromInput = document.createElement('input');
    fromInput.type = 'date';
    fromInput.id   = 'hc35-from';
    panel.appendChild(fromInput);

    var toLabel = document.createElement('label');
    toLabel.textContent = 'TO DATE';
    panel.appendChild(toLabel);

    var toInput = document.createElement('input');
    toInput.type = 'date';
    toInput.id   = 'hc35-to';
    panel.appendChild(toInput);

    var goBtn = document.createElement('button');
    goBtn.id          = 'hc35-date-go';
    goBtn.textContent = '\uD83D\uDD0D Search & Download';
    goBtn.addEventListener('click', function() {
      panel.style.display = 'none';
      handleBatchRun();
    });
    panel.appendChild(goBtn);

    document.body.appendChild(panel);

    // ── Single-thread button ──
    var btn = document.createElement('button');
    btn.id          = 'hc35-btn';
    btn.textContent = '\uD83D\uDCE5 Download HC-35 PDFs';
    btn.addEventListener('click', handleClick);
    document.body.appendChild(btn);

    // ── Batch button — toggles the date panel ──
    var batchBtn = document.createElement('button');
    batchBtn.id          = 'hc35-batch-btn';
    batchBtn.textContent = '\uD83D\uDCC2 Batch: Search & Download All';
    batchBtn.addEventListener('click', function() {
      if (batchBtn.disabled) return;
      var p = document.getElementById('hc35-date-panel');
      if (p) p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
    });
    document.body.appendChild(batchBtn);
  }

  // Re-inject if Gmail swaps <body>
  new MutationObserver(function() {
    if (document.body && !document.getElementById('hc35-btn')) injectUI();
  }).observe(document.documentElement, { childList: true, subtree: false });

  if (document.body) injectUI();
  else document.addEventListener('DOMContentLoaded', injectUI, { once: true });

  // ── Logging ───────────────────────────────────────────────────────────────────
  function log(msg) {
    var el = document.getElementById('hc35-status');
    if (el) { el.style.display = 'block'; el.textContent += msg + '\n'; el.scrollTop = el.scrollHeight; }
    console.log('[HC-35]', msg);
  }
  function clearLog() {
    var el = document.getElementById('hc35-status');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  // ── Field parsing ─────────────────────────────────────────────────────────────
  function formatDate(dateStr) {
    var m = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
    if (!m) return null;
    return m[1].padStart(2, '0') + (MONTHS[m[2].toLowerCase()] || null) + m[3];
  }

  function lookupName(rankAndName) {
    var withoutRank = rankAndName.trim().toUpperCase().replace(/^\S+\s+/, '');
    for (var i = 0; i < NAME_BANK_SORTED.length; i++) {
      if (withoutRank.includes(NAME_BANK_SORTED[i])) return NAME_BANK_SORTED[i].replace(/\s+/g, '');
    }
    return null;
  }

  function parseEmailFields(text) {
    var flat = text.replace(/\s+/g, ' ');
    var isSafety    = flat.includes('Submit Safety Officer Verification');
    var isEquipment = flat.includes('Submit Equipment Checklist');
    var type        = isSafety ? 'safety' : (isEquipment ? 'equipment' : 'unknown');

    var dateMatch  = flat.match(/Start Date\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
    var startDate  = dateMatch ? formatDate(dateMatch[1]) : null;

    var subunitMatch = flat.match(/Training\s*\/\s*sub-unit[:\s]+(.+?)(?=Nearest|I would|Section)/i);
    var subunit      = subunitMatch
      ? subunitMatch[1].trim().toUpperCase().replace(/[\s_\/\\]+/g, '')
      : null;

    var nameMatch = flat.match(/RANK AND NAME\s+([A-Za-z0-9]+(?:\s+[A-Za-z]+)*)/i);
    var rawName   = nameMatch ? nameMatch[1].trim() : null;
    var name      = rawName ? lookupName(rawName) : null;

    return { name: name, subunit: subunit, startDate: startDate, type: type, rawName: rawName };
  }

  function buildFilename(fields) {
    if (!fields.name || !fields.subunit || !fields.startDate) return null;
    var base = fields.name + '_' + fields.subunit + '_' + fields.startDate;
    return fields.type === 'safety' ? base + '_SAFETY.pdf' : base + '.pdf';
  }

  // ── Expansion helpers ─────────────────────────────────────────────────────────
  var SETTLE_MS  = 300;
  var TIMEOUT_MS = 4000;

  function uncollapseAll() {
    document.querySelectorAll('[role="listitem"]').forEach(function(item) {
      if (!item.querySelector('.a3s')) {
        var sels = ['td.gK', '[data-message-id]', 'tr.zA', '.ata', 'td[colspan]', 'td'];
        for (var s = 0; s < sels.length; s++) {
          var el = item.querySelector(sels[s]);
          if (el) { el.click(); break; }
        }
      }
    });
    document.querySelectorAll('.adx, .adf, .ajn').forEach(function(el) { el.click(); });
  }

  function waitForExpansion() {
    return new Promise(function(resolve) {
      var settleTimer = null;
      var deadline = setTimeout(function() { obs.disconnect(); resolve(); }, TIMEOUT_MS);
      var settle = function() {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(function() { obs.disconnect(); clearTimeout(deadline); resolve(); }, SETTLE_MS);
      };
      var obs = new MutationObserver(settle);
      obs.observe(document.body, { childList: true, subtree: true, attributes: false });
      uncollapseAll();
      settle();
    });
  }

  // ── Attachment discovery ──────────────────────────────────────────────────────
  function getAttachmentUrls(item) {
    var urls = new Set();
    item.querySelectorAll('a').forEach(function(a) {
      var href = a.href || '';
      if (href.includes('attid=') && href.includes('view=att')) urls.add(href);
    });
    item.querySelectorAll('[data-downloadurl]').forEach(function(el) {
      var raw = el.getAttribute('data-downloadurl') || '';
      var idx = raw.indexOf('https://');
      if (idx !== -1) urls.add(raw.slice(idx));
    });
    return Array.from(urls);
  }

  function getMessages() {
    return Array.from(document.querySelectorAll('[role="listitem"]')).reduce(function(acc, item) {
      var bodyEl = item.querySelector('.a3s');
      if (!bodyEl) return acc;
      var text = bodyEl.innerText || '';
      if (!text.includes('HC-35') && !text.includes('RANK AND NAME')) return acc;
      var urls = getAttachmentUrls(item);
      if (urls.length > 0) acc.push({ text: text, urls: urls });
      return acc;
    }, []);
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  function fetchAttachment(url) {
    return new Promise(function(resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET', url: url, responseType: 'arraybuffer',
        onload:  function(res) { res.status === 200 ? resolve(res.response) : reject(new Error('HTTP ' + res.status)); },
        onerror: function(err) { reject(new Error(JSON.stringify(err))); },
      });
    });
  }

  // ── Process current thread ────────────────────────────────────────────────────
  async function processCurrentThread() {
    await waitForExpansion();
    uncollapseAll();
    await sleep(SETTLE_MS);

    var messages = getMessages();
    if (messages.length === 0) return { downloaded: 0, errors: 0 };

    var work = [];
    messages.forEach(function(msg) {
      var fields   = parseEmailFields(msg.text);
      var filename = buildFilename(fields);
      if (filename) {
        work.push({ urls: msg.urls, filename: filename });
      } else {
        log('  \u26A0\uFE0F  Skipped: name=' + (fields.rawName || '?') +
            ' matched=' + (fields.name || 'NO') +
            ' subunit=' + (fields.subunit || '?') +
            ' date=' + (fields.startDate || '?'));
      }
    });
    if (work.length === 0) return { downloaded: 0, errors: 0 };

    var tasks = [];
    work.forEach(function(w) {
      log('  \uD83D\uDCBE ' + w.filename);
      w.urls.forEach(function(url) {
        tasks.push(
          fetchAttachment(url)
            .then(function(buffer) {
              var blob    = new Blob([buffer], { type: 'application/pdf' });
              var blobUrl = URL.createObjectURL(blob);
              GM_download({
                url: blobUrl, name: w.filename,
                onload:  function() { URL.revokeObjectURL(blobUrl); },
                onerror: function(e) { log('\u274C Download error (' + w.filename + '): ' + JSON.stringify(e)); },
              });
              return { ok: true };
            })
            .catch(function(e) { log('\u274C Fetch error: ' + e.message); return { ok: false }; })
        );
      });
    });

    var results = await Promise.all(tasks);
    return {
      downloaded: results.filter(function(r) { return r.ok; }).length,
      errors:     results.filter(function(r) { return !r.ok; }).length,
    };
  }

  // ── General helpers ───────────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  // Waits until window.location.href changes FROM the given previousUrl
  function waitForUrlChange(previousUrl, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function(resolve) {
      var start = Date.now();
      var poll = setInterval(function() {
        if (window.location.href !== previousUrl || Date.now() - start > timeoutMs) {
          clearInterval(poll);
          setTimeout(resolve, 800);
        }
      }, 100);
    });
  }

  function waitForElement(selector, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise(function(resolve) {
      if (document.querySelector(selector)) { resolve(); return; }
      var obs = new MutationObserver(function() {
        if (document.querySelector(selector)) { obs.disconnect(); resolve(); }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { obs.disconnect(); resolve(); }, timeoutMs);
    });
  }

  // ── Search ────────────────────────────────────────────────────────────────────
  function buildQuery(fromDate, toDate) {
    var q = 'HC-35';
    if (fromDate) {
      q += ' after:' + fromDate.replace(/-/g, '/');
    }
    if (toDate) {
      var d = new Date(toDate);
      d.setDate(d.getDate() + 1);
      var y  = d.getFullYear();
      var mo = String(d.getMonth() + 1).padStart(2, '0');
      var dy = String(d.getDate()).padStart(2, '0');
      q += ' before:' + y + '/' + mo + '/' + dy;
    }
    return q;
  }

  // Navigate to a Gmail search and wait until threads are visible.
  // Returns the stable search URL (captured after Gmail finishes navigating).
  async function triggerSearch(query) {
    const encoded = encodeURIComponent(query);
    const target  = location.origin + location.pathname + '#search/' + encoded;

    location.assign(target);

    // Wait until the hash contains our search term (encoded or decoded)
    await new Promise(function(resolve) {
      var start = Date.now();
      var timer = setInterval(function() {
        var h = decodeURIComponent(location.hash);
        if (h.includes('HC-35')) { clearInterval(timer); resolve(); return; }
        if (Date.now() - start > 12000) { clearInterval(timer); resolve(); }
      }, 200);
    });

    // Wait for at least one thread row or an empty-state indicator
    await new Promise(function(resolve) {
      var start = Date.now();
      var timer = setInterval(function() {
        if (
          document.querySelector('tr.zA') ||
          document.querySelector('[aria-label="No conversations"]') ||
          // Gmail's "No matching conversations" text node lives here:
          document.querySelector('.TC')
        ) { clearInterval(timer); resolve(); return; }
        if (Date.now() - start > 12000) { clearInterval(timer); resolve(); }
      }, 250);
    });

    await sleep(800);
    return window.location.href; // stable search URL
  }

  // ── Thread list helpers ───────────────────────────────────────────────────────
  function collectThreadRows() {
    var rows = Array.from(document.querySelectorAll('tr.zA'));
    if (rows.length) return rows;
    return Array.from(document.querySelectorAll('[role="row"][jscontroller]'));
  }

  // Snapshot enough data from a row to re-find it after re-render
  function snapshotRow(row) {
    // Gmail stamps each thread row with a thread id in the checkbox or link
    var id = row.getAttribute('data-legacy-thread-id') ||
             row.getAttribute('id') ||
             (row.querySelector('[data-legacy-thread-id]') || {}).getAttribute && row.querySelector('[data-legacy-thread-id]').getAttribute('data-legacy-thread-id') ||
             null;
    // Subject text as fallback
    var subjectEl = row.querySelector('.bog, .y6, span[data-thread-id]');
    var subject = subjectEl ? subjectEl.textContent.trim() : '';
    return { id: id, subject: subject };
  }

  // Returns the "next page" button if it is enabled, otherwise null
  function getNextPageButton() {
    var candidates = Array.from(document.querySelectorAll(
      'div[aria-label="Older"], button[aria-label="Older"], ' +
      'div[aria-label="Next page"], button[aria-label="Next page"], ' +
      'div[data-tooltip="Older"], button[data-tooltip="Older"]'
    ));
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.getAttribute('aria-disabled') === 'true') continue;
      if (el.disabled) continue;
      if (el.classList.contains('disabled')) continue;
      return el;
    }
    return null;
  }

  // Open a thread row. Waits for the thread view to appear.
  async function openThread(row) {
    var prevUrl = window.location.href;
    row.click();
    // Wait for the URL to change from the search URL to a thread URL
    await waitForUrlChange(prevUrl, 8000);
    // Wait for the thread body to appear
    await waitForElement('[role="listitem"] .a3s', 8000);
    await sleep(600);
  }

  // Navigate back to the search results page (by hash, not history.back)
  async function goBackToSearch(searchUrl) {
    var prevUrl = window.location.href;
    // Use the exact search URL we captured — avoids history ambiguity
    location.assign(searchUrl);
    await waitForUrlChange(prevUrl, 8000);
    // Wait for thread rows to reappear
    await waitForElement('tr.zA', 10000);
    await sleep(600);
  }

  // ── Batch button UI helpers ───────────────────────────────────────────────────
  function setBatchProgress(current, total) {
    var btn = document.getElementById('hc35-batch-btn');
    if (!btn) return;
    while (btn.firstChild) btn.removeChild(btn.firstChild);
    btn.appendChild(document.createTextNode('\u23F3 ' + current + ' / ' + total));
    var bar  = document.createElement('span'); bar.className = 'hc35-bar';
    var fill = document.createElement('span'); fill.className = 'hc35-fill';
    fill.style.width = (total > 0 ? Math.round((current / total) * 100) : 0) + '%';
    bar.appendChild(fill);
    btn.appendChild(bar);
  }

  function setBatchLabel(text) {
    var btn = document.getElementById('hc35-batch-btn');
    if (btn) btn.textContent = text;
  }

  function setBatchDone(downloaded, errors) {
    var btn = document.getElementById('hc35-batch-btn');
    if (!btn) return;
    btn.disabled  = false;
    btn.className = (errors > 0 && downloaded === 0) ? 'hc35-error' : 'hc35-done';
    btn.textContent = (errors > 0 && downloaded === 0)
      ? '\u274C Done \u2014 0 downloaded, ' + errors + ' error(s)'
      : '\u2705 Done \u2014 ' + downloaded + ' downloaded' + (errors ? ', ' + errors + ' error(s)' : '');
  }

  // ── Single-thread handler ─────────────────────────────────────────────────────
  async function handleClick() {
    clearLog();
    var btn = document.getElementById('hc35-btn');
    btn.disabled = true;
    btn.textContent = '\u23F3 Working\u2026';

    try {
      await waitForExpansion();
      uncollapseAll();
      await sleep(SETTLE_MS);

      var messages = getMessages();
      if (messages.length === 0) {
        log('\u26A0\uFE0F  No HC-35 messages with attachments found.\nMake sure the thread is open.');
        return;
      }
      log('\uD83D\uDCEC Found ' + messages.length + ' message(s).\n');

      var work = [];
      messages.forEach(function(msg) {
        var fields   = parseEmailFields(msg.text);
        var filename = buildFilename(fields);
        log('Name    : ' + (fields.rawName   || '(not found)'));
        log('Matched : ' + (fields.name      || '\u274C NOT IN NAME_BANK'));
        log('Subunit : ' + (fields.subunit   || '(not found)'));
        log('Date    : ' + (fields.startDate || '(not found)'));
        log('Type    : ' + fields.type);
        if (!filename) {
          log(!fields.name
            ? '\u274C Add "' + fields.rawName + '" to NAME_BANK.\n'
            : '\u274C Missing date or subunit \u2014 skipping.\n');
          return;
        }
        log('\uD83D\uDCBE Saving as: ' + filename + '\n');
        work.push({ urls: msg.urls, filename: filename });
      });

      if (work.length === 0) { log('\u26A0\uFE0F  No valid files.'); return; }

      var tasks = [];
      work.forEach(function(w) {
        w.urls.forEach(function(url) {
          tasks.push(
            fetchAttachment(url)
              .then(function(buffer) {
                var blob    = new Blob([buffer], { type: 'application/pdf' });
                var blobUrl = URL.createObjectURL(blob);
                GM_download({
                  url: blobUrl, name: w.filename,
                  onload:  function() { URL.revokeObjectURL(blobUrl); },
                  onerror: function(e) { log('\u274C Download error: ' + JSON.stringify(e)); },
                });
                return { ok: true };
              })
              .catch(function(e) { return { ok: false, err: e.message }; })
          );
        });
      });

      var results = await Promise.all(tasks);
      var ok = results.filter(function(r) { return r.ok; }).length;
      results.filter(function(r) { return !r.ok; }).forEach(function(r) { log('\u274C ' + r.err); });
      log(ok > 0 ? '\u2705 Done \u2014 ' + ok + ' file(s) downloaded.' : '\u26A0\uFE0F  No files downloaded.');

    } finally {
      btn.disabled = false;
      btn.textContent = '\uD83D\uDCE5 Download HC-35 PDFs';
    }
  }

  // ── Batch runner ──────────────────────────────────────────────────────────────
  async function handleBatchRun() {
    clearLog();

    var fromVal = (document.getElementById('hc35-from') || {}).value || '';
    var toVal   = (document.getElementById('hc35-to')   || {}).value || '';

    var batchBtn = document.getElementById('hc35-batch-btn');
    batchBtn.disabled  = true;
    batchBtn.className = '';
    setBatchLabel('\uD83D\uDD0D Searching\u2026');

    var totalDownloaded = 0;
    var totalErrors     = 0;
    var pageNum         = 1;

    try {
      var query = buildQuery(fromVal || null, toVal || null);
      log('\uD83D\uDD0D Query: ' + query);

      // triggerSearch returns the stable URL of the search results page
      var searchUrl = await triggerSearch(query);
      log('\uD83D\uDD17 Search URL: ' + searchUrl);

      // ── paginate through ALL result pages ──────────────────────────────────
      while (true) {
        // Make sure we're on the search page with rows visible
        await waitForElement('tr.zA', 10000);
        await sleep(600);

        var rows = collectThreadRows();

        if (rows.length === 0) {
          log(pageNum === 1
            ? '\u26A0\uFE0F  No results found for this date range.'
            : '\u26A0\uFE0F  No rows on page ' + pageNum + ' \u2014 stopping.');
          break;
        }

        log('\n\uD83D\uDCC4 Page ' + pageNum + ': ' + rows.length + ' thread(s)');

        // Snapshot row count before we start (rows are re-rendered after back-nav)
        var totalOnPage = rows.length;

        // Process every thread on this page by index
        for (var i = 0; i < totalOnPage; i++) {
          setBatchProgress(i + 1, totalOnPage);
          log('\n  \u2500 Thread ' + (i + 1) + '/' + totalOnPage + ' (page ' + pageNum + ')');

          try {
            // Re-collect rows each iteration — Gmail re-renders after navigation
            var currentRows = collectThreadRows();
            if (currentRows.length === 0) {
              // We're not on the search page — navigate back first
              log('  \u21BA Not on search page, navigating back\u2026');
              await goBackToSearch(searchUrl);
              currentRows = collectThreadRows();
            }

            var row = currentRows[i];
            if (!row) { log('  \u26A0\uFE0F  Row ' + i + ' not found \u2014 skipping.'); continue; }

            await openThread(row);

            var result = await processCurrentThread();
            totalDownloaded += result.downloaded;
            totalErrors     += result.errors;
            log('  \u21B3 ' + result.downloaded + ' downloaded, ' + result.errors + ' error(s)');

          } catch (threadErr) {
            log('  \u274C Thread error: ' + threadErr.message);
            totalErrors++;
          }

          // Always navigate back to the search page after each thread
          await goBackToSearch(searchUrl);
        }

        // ── Try to go to next page ──────────────────────────────────────────
        var nextBtn = getNextPageButton();
        if (!nextBtn) {
          log('\n\uD83C\uDFC1 All pages processed.');
          break;
        }

        log('\n\u27A1\uFE0F  Going to page ' + (pageNum + 1) + '\u2026');
        var prevUrl = window.location.href;
        nextBtn.click();
        await waitForUrlChange(prevUrl, 8000);
        // Update searchUrl to the new page URL so goBackToSearch works correctly
        await waitForElement('tr.zA', 10000);
        await sleep(600);
        searchUrl = window.location.href;
        pageNum++;
      }

      log('\n\u2705 Batch done \u2014 ' + totalDownloaded + ' downloaded, ' + totalErrors + ' error(s).');
      setBatchDone(totalDownloaded, totalErrors);

    } catch (err) {
      log('\u274C Batch failed: ' + err.message);
      var b = document.getElementById('hc35-batch-btn');
      if (b) { b.className = 'hc35-error'; b.textContent = '\u274C Batch failed \u2014 see log'; b.disabled = false; }
    }
  }

})();
