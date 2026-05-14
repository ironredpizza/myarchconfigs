// ==UserScript==
// @name         YouTube → Gemini UI
// @namespace    http://tampermonkey.net/
// @version      5.13
// @description  Gemini button on YouTube watch page and video cards
// @match        https://www.youtube.com/*
// @match        https://gemini.google.com/*
// @grant        GM_openInTab
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // ─── YOUTUBE SIDE ───────────────────────────────────────────────
  if (location.hostname.includes("youtube.com")) {

    const style = document.createElement('style');
    style.textContent = `
      .ytg-btn-card {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: #1a1a2e;
        cursor: pointer;
        font-size: 14px;
        flex-shrink: 0;
        vertical-align: middle;
      }
      .ytg-btn-card:hover { background: #4285F4; }

      .ytg-watch-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        font-size: 18px;
        color: #9B72CB;
        flex-shrink: 0;
        transition: background-color 0.2s, color 0.2s;
        font-weight: 500;
        line-height: 1;
      }
      .ytg-watch-btn:hover {
        background: rgba(255,255,255,0.1);
        color: #9B72CB;
      }
      .ytg-watch-btn:active {
        background: rgba(255,255,255,0.2);
      }

      .ytg-watch-container {
        display: inline-flex;
        align-items: center;
        height: 36px;
        margin-right: 8px;
      }
    `;
    document.head.appendChild(style);

    function makeCardBtn(url) {
      const btn = document.createElement('button');
      btn.className = 'ytg-btn-card';
      btn.title = 'Open in Gemini';
      btn.textContent = '✦';
      btn.style.color = '#9B72CB';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GM_openInTab('https://gemini.google.com/app?q=' + encodeURIComponent(url), { active: false });
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GM_setValue("ytg_url", url);
        GM_setValue("ytg_session", Date.now().toString());
        window.open('https://gemini.google.com/app', '_blank', 'width=1200,height=800');
      });

      return btn;
    }

    function makeWatchBtn(url) {
      const btn = document.createElement('button');
      btn.id = 'ytg-watch-btn';
      btn.className = 'ytg-watch-btn';
      btn.title = 'Open in Gemini';
      btn.setAttribute('aria-label', 'Open in Gemini');
      btn.textContent = '✦';

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GM_openInTab('https://gemini.google.com/app?q=' + encodeURIComponent(url), { active: false });
      });

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        GM_setValue("ytg_url", url);
        GM_setValue("ytg_session", Date.now().toString());
        window.open('https://gemini.google.com/app', '_blank', 'width=1200,height=800');
      });

      return btn;
    }

    function injectWatchBtn() {
      if (document.getElementById('ytg-watch-btn')) return;

      const segmentedBtn = document.querySelector('segmented-like-dislike-button-view-model');
      if (!segmentedBtn) return;

      const topLevelButtons = segmentedBtn.closest('#top-level-buttons-computed');
      if (!topLevelButtons) return;

      const container = document.createElement('div');
      container.className = 'ytg-watch-container';
      container.appendChild(makeWatchBtn(location.href));

      topLevelButtons.insertAdjacentElement('afterbegin', container);
    }

    function injectCardBtns() {
      document.querySelectorAll('div.ytLockupMetadataViewModelMenuButton').forEach(menuDiv => {
        if (menuDiv.dataset.ytgDone) return;
        const card = menuDiv.closest('yt-lockup-view-model');
        if (!card) return;
        const a = card.querySelector('a[href*="/watch"]');
        if (!a) return;
        const match = a.getAttribute('href').match(/\/watch\?v=[^&]+/);
        if (!match) return;
        const url = 'https://www.youtube.com' + match[0];
        menuDiv.appendChild(makeCardBtn(url));
        menuDiv.dataset.ytgDone = '1';
      });
    }

    let pending = false;
    new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        injectCardBtns();
        if (location.pathname.startsWith('/watch')) injectWatchBtn();
      });
    }).observe(document.body, { childList: true, subtree: true });

    window.addEventListener('yt-navigate-finish', () => {
      document.querySelector('.ytg-watch-container')?.remove();
      setTimeout(() => {
        injectCardBtns();
        if (location.pathname.startsWith('/watch')) injectWatchBtn();
      }, 1000);
    });

    injectCardBtns();
    if (location.pathname.startsWith('/watch')) injectWatchBtn();
    setTimeout(injectCardBtns, 2000);
  }

  // ─── GEMINI SIDE ─────────────────────���─────────────────────────
  if (location.hostname.includes("gemini.google.com")) {
    (async function () {
      if (window.__ytgRunning) return;

      // Check for URL in query params first (from background tab)
      const params = new URLSearchParams(location.search);
      const promptFromUrl = params.get('q');

      // Check for URL from GM_getValue (from new window)
      const urlFromStorage = GM_getValue("ytg_url", null);
      const sessionFromStorage = GM_getValue("ytg_session", null);

      const prompt = promptFromUrl || urlFromStorage;

      if (!prompt) return;

      if (urlFromStorage && sessionFromStorage) {
        GM_setValue("ytg_url", null);
        GM_setValue("ytg_session", null);
      }

      window.__ytgRunning = true;

      let done = false;

      function inject() {
        if (done) return true;

        const input = document.querySelector('div[contenteditable="true"]');

        if (!input) return false;

        done = true;
        input.focus();

        document.execCommand('insertText', false, prompt);

        input.dispatchEvent(new Event('input', { bubbles: true }));

        console.log('[Gemini] Prompt inserted');

        setTimeout(() => {
          const sendBtn = [...document.querySelectorAll('button')]
            .find(btn =>
              btn.getAttribute('aria-label')?.toLowerCase().includes('send')
            );

          console.log('[Gemini] Trying to send');

          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
          }
        }, 8000);

        return true;
      }

      if (inject()) return;

      const observer = new MutationObserver(() => {
        if (inject()) {
          observer.disconnect();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

    })();
  }

})();
