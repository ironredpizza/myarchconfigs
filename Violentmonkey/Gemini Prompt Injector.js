// ==UserScript==
// @name         Gemini URL Prompt Injector
// @match        https://gemini.google.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const prompt = params.get('q');

  if (!prompt) return;

  let done = false;

  function inject() {
    if (done) return true;

    const input = document.querySelector(
      'div[contenteditable="true"]'
    );

    if (!input) return false;

    done = true;

    input.focus();

    // This part actually works reliably
    document.execCommand('insertText', false, prompt);

    input.dispatchEvent(new Event('input', {
      bubbles: true
    }));

    console.log('[Gemini] Prompt inserted');

    // IMPORTANT:
    // Wait MUCH longer before sending
    // Gemini needs time to process YouTube URLs
    setTimeout(() => {

      const sendBtn = [...document.querySelectorAll('button')]
        .find(btn =>
          btn.getAttribute('aria-label')?.toLowerCase().includes('send')
        );

      console.log('[Gemini] Trying to send');

      if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
      }

    }, 8000); // <- key change

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
