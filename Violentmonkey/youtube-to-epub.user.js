// ==UserScript==
// @name         YouTube to EPUB
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  One-click: grabs YouTube transcript, cleans it with Gemini, downloads as EPUB
// @author       Joey
// @match        https://www.youtube.com/watch*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      generativelanguage.googleapis.com
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// ==/UserScript==

(function () {
  'use strict';

  // ── Styles ───────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #yt-epub-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      background: #cc0000;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: background 0.2s;
    }
    #yt-epub-btn:hover { background: #aa0000; }
    #yt-epub-btn:disabled { background: #888; cursor: not-allowed; }
    #yt-epub-status {
      position: fixed;
      bottom: 70px;
      right: 24px;
      z-index: 9999;
      background: rgba(0,0,0,0.8);
      color: #fff;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      display: none;
      max-width: 280px;
    }
  `;
  document.head.appendChild(style);

  // ── UI ────────────────────────────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'yt-epub-btn';
  btn.textContent = '📖 Download EPUB';
  document.body.appendChild(btn);

  const status = document.createElement('div');
  status.id = 'yt-epub-status';
  document.body.appendChild(status);

  function setStatus(msg) {
    status.style.display = msg ? 'block' : 'none';
    status.textContent = msg;
  }

  function setBtn(disabled, label) {
    btn.disabled = disabled;
    btn.textContent = label;
  }

  // ── API Key ───────────────────────────────────────────────────────────────────
  async function getApiKey() {
    let key = await GM_getValue('gemini_api_key', '');
    if (!key) {
      key = prompt('Enter your Gemini API key (stored locally, never shared):');
      if (key) await GM_setValue('gemini_api_key', key.trim());
    }
    return key ? key.trim() : null;
  }

  // ── Video metadata ────────────────────────────────────────────────────────────
  function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
  }

  function getVideoTitle() {
    return document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      || document.title.replace(' - YouTube', '').trim()
      || 'YouTube Video';
  }

  // ── YouTube chapters ──────────────────────────────────────────────────────────
  function getYouTubeChapters() {
    const chapters = [];
    document.querySelectorAll('ytd-macro-markers-list-item-renderer').forEach(item => {
      const title = item.querySelector('#details h4')?.textContent?.trim();
      const time  = item.querySelector('#details p')?.textContent?.trim();
      if (title && time) chapters.push({ title, time });
    });
    return chapters;
  }

  // ── Fetch transcript ──────────────────────────────────────────────────────────
  async function fetchTranscript(videoId) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://www.youtube.com/watch?v=' + videoId,
        onload(res) {
          try {
            const match = res.responseText.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
            if (!match) throw new Error('Could not find player response');
            const playerData = JSON.parse(match[1]);
            const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
            if (!captionTracks || captionTracks.length === 0)
              throw new Error('No captions found for this video');
            const track = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
            const url = track.baseUrl + '&fmt=json3';
            GM_xmlhttpRequest({
              method: 'GET',
              url,
              onload(r2) {
                try {
                  const data = JSON.parse(r2.responseText);
                  const lines = [];
                  (data.events || []).forEach(ev => {
                    if (!ev.segs) return;
                    const text = ev.segs.map(s => s.utf8 || '').join('').replace(/\n/g, ' ').trim();
                    if (text) {
                      const secs = Math.floor((ev.tStartMs || 0) / 1000);
                      const mm = String(Math.floor(secs / 60)).padStart(2, '0');
                      const ss = String(secs % 60).padStart(2, '0');
                      lines.push('[' + mm + ':' + ss + '] ' + text);
                    }
                  });
                  resolve(lines.join('\n'));
                } catch (e) { reject(e); }
              },
              onerror(e) { reject(new Error('Failed to fetch transcript: ' + e)); }
            });
          } catch (e) { reject(e); }
        },
        onerror(e) { reject(new Error('Failed to fetch page: ' + e)); }
      });
    });
  }

  // ── Gemini API ────────────────────────────────────────────────────────────────
  async function callGemini(apiKey, prompt) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
        }),
        onload(res) {
          try {
            const data = JSON.parse(res.responseText);
            if (data.error) return reject(new Error(data.error.message));
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return reject(new Error('Empty response from Gemini'));
            resolve(text);
          } catch (e) { reject(e); }
        },
        onerror(e) { reject(new Error('Gemini request failed: ' + e)); }
      });
    });
  }

  // ── Build prompt ──────────────────────────────────────────────────────────────
  function buildPrompt(title, transcript, chapters) {
    const chapterInfo = chapters.length > 0
      ? 'The video has these chapters:\n' + chapters.map(c => '- ' + c.time + ': ' + c.title).join('\n') + '\nUse these as your chapter divisions.'
      : 'The video has no predefined chapters. Read the transcript and divide it into logical chapters yourself based on topic shifts.';

    return 'You are formatting a YouTube transcript into a clean, readable document for an EPUB.\n\n'
      + 'Video title: "' + title + '"\n\n'
      + chapterInfo + '\n\n'
      + 'STRICT RULES:\n'
      + '1. Do NOT paraphrase or summarise. Keep the speaker\'s exact words.\n'
      + '2. Only fix: obvious speech-to-text errors (wrong homophones, garbled words), punctuation, and capitalisation.\n'
      + '3. Merge transcript fragments into proper sentences and paragraphs.\n'
      + '4. Within each chapter, group content into logical sub-sections of roughly 2-4 minutes each.\n'
      + '   Each sub-section gets a ## timestamp subheading showing the start time of that block in [MM:SS] format.\n'
      + '   Example: ## [04:32]\n\n'
      + '5. Output the result in this EXACT format:\n\n'
      + '# [Chapter Title]\n\n'
      + '## [MM:SS]\n\n'
      + '[paragraph text]\n\n'
      + '[paragraph text]\n\n'
      + '## [MM:SS]\n\n'
      + '[paragraph text]\n\n'
      + '# [Next Chapter Title]\n\n'
      + '## [MM:SS]\n\n'
      + '[paragraph text]\n\n'
      + 'Use # for chapter titles and ## for timestamp subheadings ONLY. No other markdown.\n\n'
      + 'Here is the transcript (lines prefixed with timestamps [MM:SS]):\n\n'
      + transcript;
  }

  // ── Parse Gemini output ───────────────────────────────────────────────────────
  // Returns: [ { title, sections: [ { timestamp, lines[] } ] } ]
  function parseChapters(text) {
    const lines = text.split('\n');
    const chapters = [];
    let currentChapter = null;
    let currentSection = null;

    for (const line of lines) {
      if (line.startsWith('# ') && !line.startsWith('## ')) {
        if (currentSection && currentChapter) currentChapter.sections.push(currentSection);
        if (currentChapter) chapters.push(currentChapter);
        currentChapter = { title: line.replace(/^# /, '').trim(), sections: [] };
        currentSection = null;
      } else if (line.startsWith('## ')) {
        if (currentSection && currentChapter) currentChapter.sections.push(currentSection);
        currentSection = { timestamp: line.replace(/^## /, '').trim(), lines: [] };
      } else if (currentSection) {
        currentSection.lines.push(line);
      } else if (currentChapter) {
        // Content before first ## — open an untimestamped section
        currentSection = { timestamp: null, lines: [line] };
      }
    }
    if (currentSection && currentChapter) currentChapter.sections.push(currentSection);
    if (currentChapter) chapters.push(currentChapter);

    if (chapters.length === 0) {
      chapters.push({ title: 'Full Transcript', sections: [{ timestamp: null, lines }] });
    }
    return chapters;
  }

  // ── HTML escape helper ────────────────────────────────────────────────────────
  function esc(str) {
    return (str || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
  }
  function escText(str) {
    return (str || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  }

  // ── Build EPUB ────────────────────────────────────────────────────────────────
  async function buildEpub(title, chapters) {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    zip.folder('META-INF').file('container.xml',
      '<?xml version="1.0"?>\n'
      + '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
      + '  <rootfiles>\n'
      + '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n'
      + '  </rootfiles>\n'
      + '</container>');

    const oebps = zip.folder('OEBPS');
    const manifestItems = [];
    const spineItems = [];

    chapters.forEach((ch, i) => {
      const id = 'chapter' + (i + 1);
      const filename = id + '.xhtml';
      const chTitle = esc(ch.title);

      // Build body HTML from sections
      let bodyHtml = '  <h1>' + chTitle + '</h1>\n';
      ch.sections.forEach(sec => {
        if (sec.timestamp) {
          bodyHtml += '  <h2 class="ts">' + esc(sec.timestamp) + '</h2>\n';
        }
        const paragraphs = sec.lines
          .join('\n')
          .split(/\n\n+/)
          .map(p => p.replace(/\n/g, ' ').trim())
          .filter(p => p.length > 0);
        paragraphs.forEach(p => {
          bodyHtml += '  <p>' + escText(p) + '</p>\n';
        });
      });

      oebps.file(filename,
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">\n'
        + '<html xmlns="http://www.w3.org/1999/xhtml">\n'
        + '<head>\n'
        + '  <title>' + chTitle + '</title>\n'
        + '  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>\n'
        + '  <style>\n'
        + '    body { font-family: serif; line-height: 1.7; margin: 2em; }\n'
        + '    h1 { font-size: 1.4em; margin-bottom: 0.4em; }\n'
        + '    h2.ts { font-size: 0.85em; font-weight: normal; color: #888; margin: 1.6em 0 0.4em; letter-spacing: 0.03em; }\n'
        + '    p { margin: 0 0 0.8em 0; text-indent: 1.2em; }\n'
        + '  </style>\n'
        + '</head>\n'
        + '<body>\n'
        + bodyHtml
        + '</body>\n'
        + '</html>');

      manifestItems.push('    <item id="' + id + '" href="' + filename + '" media-type="application/xhtml+xml"/>');
      spineItems.push('    <itemref idref="' + id + '"/>');
    });

    // NCX table of contents
    const navPoints = chapters.map((ch, i) =>
      '  <navPoint id="nav' + (i+1) + '" playOrder="' + (i+1) + '">\n'
      + '    <navLabel><text>' + esc(ch.title) + '</text></navLabel>\n'
      + '    <content src="chapter' + (i+1) + '.xhtml"/>\n'
      + '  </navPoint>'
    ).join('\n');

    oebps.file('toc.ncx',
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n'
      + '  <head>\n'
      + '    <meta name="dtb:uid" content="youtube-epub-001"/>\n'
      + '    <meta name="dtb:depth" content="1"/>\n'
      + '  </head>\n'
      + '  <docTitle><text>' + esc(title) + '</text></docTitle>\n'
      + '  <navMap>\n'
      + navPoints + '\n'
      + '  </navMap>\n'
      + '</ncx>');

    oebps.file('content.opf',
      '<?xml version="1.0" encoding="UTF-8"?>\n'
      + '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="2.0">\n'
      + '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
      + '    <dc:title>' + esc(title) + '</dc:title>\n'
      + '    <dc:language>en</dc:language>\n'
      + '    <dc:identifier id="bookid">youtube-epub-001</dc:identifier>\n'
      + '  </metadata>\n'
      + '  <manifest>\n'
      + manifestItems.join('\n') + '\n'
      + '    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n'
      + '  </manifest>\n'
      + '  <spine toc="ncx">\n'
      + spineItems.join('\n') + '\n'
      + '  </spine>\n'
      + '</package>');

    return await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
  }

  // ── Download ──────────────────────────────────────────────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ── Main ──────────────────────────────────────────────────────────────────────
  btn.addEventListener('click', async () => {
    setBtn(true, '⏳ Working...');
    try {
      setStatus('Getting API key...');
      const apiKey = await getApiKey();
      if (!apiKey) throw new Error('No API key provided.');

      setStatus('Reading video info...');
      const videoId = getVideoId();
      if (!videoId) throw new Error('No video ID found. Are you on a YouTube watch page?');
      const title = getVideoTitle();
      const chapters = getYouTubeChapters();

      setStatus('Fetching transcript...');
      const transcript = await fetchTranscript(videoId);
      if (!transcript) throw new Error('No transcript found.');

      setStatus('Sending to Gemini for cleanup...');
      const prompt = buildPrompt(title, transcript, chapters);
      const geminiOutput = await callGemini(apiKey, prompt);

      setStatus('Formatting chapters...');
      const parsedChapters = parseChapters(geminiOutput);

      setStatus('Building EPUB...');
      const epub = await buildEpub(title, parsedChapters);

      const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.epub';
      downloadBlob(epub, filename);

      setStatus('✅ Done! Check your downloads.');
      setBtn(false, '📖 Download EPUB');
      setTimeout(() => setStatus(''), 4000);

    } catch (err) {
      setStatus('❌ Error: ' + err.message);
      setBtn(false, '📖 Download EPUB');
      console.error('[YT-EPUB]', err);
    }
  });

})();
