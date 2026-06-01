// ==UserScript==
// @name         HC-35 Gmail PDF Auto-Downloader
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Reads HC-35 fields from the Gmail email body, then downloads and renames the attached PDF as NAME_SUBUNIT_DATE or NAME_SUBUNIT_DATE_SAFETY
// @author       You
// @match        https://mail.google.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      mail-attachment.googleusercontent.com
// ==/UserScript==

(function () {
  'use strict';

  // ─── Name Bank ─────────────────────────────────────────────────────────────
  // Add names here exactly as you want them in the filename.
  // The script checks if the entry appears anywhere in the name field (minus rank).
  // Example: "MUHAMMAD NURAZRIE" contains "AZRIE" → filename uses "AZRIE"
  //
  // Add new entries as:  'NAME',
  const NAME_BANK = [
    'AZRIE',
    'NORVIN',
    'ZILHAN',
    'ISHAAN',
    'SYAQIL',
          'RYAN CHONG',
          'WENXUAN',
                'RONALD',
                'KHALIS',
                      'ZHUOLIN',
                            'KENNETH',
          'TAURIQ',
                'JOSHUA',
                'JUN YI',
    'AZYRFAN',
    'DYLAN',
    'KEYAN',
    'SEAN',
          'AJEY',
    'KRIS',
    'TOBY',
    'HONG MING',
    // Add more names below this line:
          'PANG ZHENG KAI RYAN',
          'AZY',
                'RYAN SIAH',
                      'JARVIS',
                'THADDEUS',
                'TENG FONG',
  ];
  // ───────────────────────────────────────────────────────────────────────────

  // ── UI ───────────────────────────────────────────────────────────────────────

  GM_addStyle(`
    #hc35-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      background: #1a73e8; color: #fff; border: none; border-radius: 8px;
      padding: 10px 18px; font-size: 14px;
      font-family: 'Google Sans', Roboto, sans-serif;
      cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    #hc35-btn:hover    { background: #1558b0; }
    #hc35-btn:disabled { background: #888; cursor: wait; }
    #hc35-status {
      position: fixed; bottom: 68px; right: 24px; z-index: 99999;
      background: #fff; border: 1px solid #dadce0; border-radius: 8px;
      padding: 12px 16px; font-size: 13px;
      font-family: 'Google Sans', Roboto, sans-serif;
      max-width: 360px; max-height: 300px; overflow-y: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      display: none; white-space: pre-wrap; word-break: break-word;
    }
  `);

  function injectUI() {
    if (document.getElementById('hc35-btn')) return;

    const status = document.createElement('div');
    status.id = 'hc35-status';
    document.body.appendChild(status);

    const btn = document.createElement('button');
    btn.id = 'hc35-btn';
    btn.textContent = '📥 Download HC-35 PDFs';
    btn.addEventListener('click', handleClick);
    document.body.appendChild(btn);
  }

  function log(msg) {
    const el = document.getElementById('hc35-status');
    if (el) { el.style.display = 'block'; el.textContent += msg + '\n'; }
    console.log('[HC-35]', msg);
  }

  function clearLog() {
    const el = document.getElementById('hc35-status');
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }

  // ── Parse fields from the email body already rendered in the DOM ─────────────

  function formatDate(dateStr) {
    const months = {
      jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
      jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12'
    };
    const m = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
    if (!m) return null;
    return m[1].padStart(2, '0') + months[m[2].toLowerCase()] + m[3];
  }

  function lookupName(rankAndName) {
    // Strip rank (first word), uppercase everything, then check each NAME_BANK entry
    const withoutRank = rankAndName.trim().toUpperCase().replace(/^\S+\s+/, '');
    for (const name of NAME_BANK) {
      // Match the bank entry anywhere in the name string (e.g. KRIS inside KRISNAVEL)
      if (withoutRank.includes(name.trim().toUpperCase())) {
        return name.trim().toUpperCase().replace(/\s+/g, '');
      }
    }
    return null;
  }

  function parseEmailFields(text) {
    // Flatten all whitespace to single spaces — fields are in separate <td>s so
    // the label and value are separated by lots of whitespace in innerText
    const flat = text.replace(/\s+/g, ' ');

    // Submission type
    const isSafety    = flat.includes('Submit Safety Officer Verification');
    const isEquipment = flat.includes('Submit Equipment Checklist');
    const type = isSafety ? 'safety' : (isEquipment ? 'equipment' : 'unknown');

    // Start Date
    const dateMatch = flat.match(/Start Date\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
    const startDate = dateMatch ? formatDate(dateMatch[1]) : null;

    // Sub-unit — grab value up to the next known field
    const subunitMatch = flat.match(/Training\s*\/\s*sub-unit[:\s]+(.+?)(?=Nearest|I would|Section)/i);
    const subunit = subunitMatch ? subunitMatch[1].trim().toUpperCase().replace(/[\s_\/\\]+/g, '') : null;

    // Rank and Name — case-insensitive, allows mixed case like "LCP Dylan"
    const nameMatch = flat.match(/RANK AND NAME\s+([A-Za-z0-9]+(?:\s+[A-Za-z]+)*)/i);
    const rawName = nameMatch ? nameMatch[1].trim() : null;
    const name = rawName ? lookupName(rawName) : null;

    return { name, subunit, startDate, type, rawName };
  }

  function buildFilename({ name, subunit, startDate, type }) {
    if (!name || !subunit || !startDate) return null;
    const base = `${name}_${subunit}_${startDate}`;
    return type === 'safety' ? `${base}_SAFETY.pdf` : `${base}.pdf`;
  }

  // ── Per-message pairing: body text ↔ attachment ──────────────────────────────
  // Gmail renders each reply as a separate [role="listitem"].
  // Within each one, the attachment link lives alongside the message body.

  function uncollapseAll() {
    // Gmail collapsed messages show as a small row with just a number bubble.
    // They don't have .a3s (the body container) until expanded.
    // Aggressively click anything that looks like a collapsed message row.
    document.querySelectorAll('[role="listitem"]').forEach(item => {
      if (!item.querySelector('.a3s')) {
        // Try every clickable element inside — collapsed rows vary by Gmail version
        const selectors = ['td.gK', '[data-message-id]', 'tr.zA', '.ata', 'td[colspan]', 'td'];
        for (const sel of selectors) {
          const el = item.querySelector(sel);
          if (el) { el.click(); break; }
        }
      }
    });

    // Also catch the "N messages collapsed" expander that appears mid-thread
    document.querySelectorAll('.adx, [data-legacy-thread-id] .adf, .ajn').forEach(el => {
      el.click();
    });
  }

  function getMessages() {
    // Each expanded message in a thread is a listitem
    const items = [...document.querySelectorAll('[role="listitem"]')];
    const messages = [];

    for (const item of items) {
      // Body text — .a3s is Gmail's message body container
      const bodyEl = item.querySelector('.a3s');
      if (!bodyEl) continue;
      const text = bodyEl.innerText || '';
      if (!text.includes('HC-35') && !text.includes('RANK AND NAME')) continue;

      // Attachment URLs within this same message item
      const urls = new Set();
      item.querySelectorAll('a').forEach(a => {
        const href = a.href || '';
        if (href.includes('attid=') && href.includes('view=att')) urls.add(href);
      });
      item.querySelectorAll('[data-downloadurl]').forEach(el => {
        const raw = el.getAttribute('data-downloadurl') || '';
        const idx = raw.indexOf('https://');
        if (idx !== -1) urls.add(raw.slice(idx));
      });

      if (urls.size > 0) messages.push({ text, urls: [...urls] });
    }

    return messages;
  }

  function fetchAttachment(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url,
        responseType: 'arraybuffer',
        onload:  res => res.status === 200
          ? resolve(res.response)
          : reject(new Error(`HTTP ${res.status}`)),
        onerror: err => reject(new Error(JSON.stringify(err))),
      });
    });
  }

  // ── Main handler ─────────────────────────────────────────────────────────────

  async function handleClick() {
    clearLog();
    const btn = document.getElementById('hc35-btn');
    btn.disabled = true;
    btn.textContent = '⏳ Working...';

    try {
      // Uncollapse all messages in the thread first, then wait for Gmail to render
      uncollapseAll();
      await new Promise(r => setTimeout(r, 1200));
      // Second pass — some messages only appear after others expand
      uncollapseAll();
      await new Promise(r => setTimeout(r, 800));

      const messages = getMessages();

      if (messages.length === 0) {
        log('⚠️  No HC-35 messages with attachments found.\nMake sure the email thread is open and expanded.');
        return;
      }

      log(`📬 Found ${messages.length} message(s) with attachments.\n`);
      let downloaded = 0;

      for (const { text, urls } of messages) {
        const fields   = parseEmailFields(text);
        const filename = buildFilename(fields);

        log(`Full name : ${fields.rawName   ?? '(not found)'}`);
        log(`Matched   : ${fields.name      ?? '❌ NOT IN NAME_BANK'}`);
        log(`Subunit   : ${fields.subunit   ?? '(not found)'}`);
        log(`Date      : ${fields.startDate ?? '(not found)'}`);
        log(`Type      : ${fields.type}`);

        if (!filename) {
          if (!fields.name) {
            log(`❌ Add "${fields.rawName}" to NAME_BANK and re-run.\n`);
          } else {
            log('❌ Missing date or subunit — skipping.\n');
          }
          continue;
        }

        log(`💾 Saving as: ${filename}`);

        for (const url of urls) {
          try {
            const buffer  = await fetchAttachment(url);
            const blob    = new Blob([buffer], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            GM_download({
              url: blobUrl, name: filename,
              onload:  () => { URL.revokeObjectURL(blobUrl); },
              onerror: e  => log(`❌ Download error: ${JSON.stringify(e)}`),
            });
            downloaded++;
          } catch (err) {
            log(`❌ Fetch error: ${err.message}`);
          }
        }
        log('');
      }

      log(downloaded > 0
        ? `✅ Done — ${downloaded} file(s) downloaded.`
        : '⚠️  No files downloaded. See errors above.');

    } finally {
      btn.disabled = false;
      btn.textContent = '📥 Download HC-35 PDFs';
    }
  }


  // ── Init ─────────────────────────────────────────────────────────────────────

  if (document.body) {
    injectUI();
  } else {
    document.addEventListener('DOMContentLoaded', injectUI, { once: true });
  }

})();
