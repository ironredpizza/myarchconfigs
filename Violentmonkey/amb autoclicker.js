// ==UserScript==
// @name         Ambulance Checklist Full Auto (Fixed Dropdown)
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Fully automated checklist with proper dropdown selection
// @match        *://*form.gov.sg/*
// @grant        none
// ==/UserScript==


(function() {
    'use strict';


    let running = false;
    let interval;


    // ─── Helper: find label text for an element ───────────────────────────────


    function getLabelFor(el) {
        if (el.id) {
            const lbl = document.querySelector(`label[for="${el.id}"]`);
            if (lbl) return lbl.textContent;
        }
        const parent = el.closest('label');
        if (parent) return parent.textContent;
        const prev = el.previousElementSibling;
        if (prev) return prev.textContent;
        return '';
    }


    // ─── Helper: fill a text input whose label contains keyword ──────────────


    function fillTextByLabel(keyword, value) {
        const inputs = document.querySelectorAll('input[type="text"], input[type="number"], textarea');
        inputs.forEach(input => {
            const labelText = getLabelFor(input) ||
                              (input.closest('[class*="field"], [class*="question"], [class*="form-group"]')
                                  ?.querySelector('label, p, span')?.textContent ?? '');
            if (labelText.toLowerCase().includes(keyword.toLowerCase())) {
                if (input.value !== value) {
                    input.value = value;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }


    // ─── Helper: select a radio by its value text ────────────────────────────


    function selectRadioByValue(value) {
        document.querySelectorAll('input[type="radio"]').forEach(r => {
            if (r.value.toLowerCase().includes(value.toLowerCase()) && !r.checked) {
                r.click();
            }
        });
    }


    // ─── 1. Medical Centre → Khatib Medical Centre ───────────────────────────


    function fillMedicalCentre() {
        // Text input
        fillTextByLabel('medical centre', 'Khatib Medical Centre');


        // Dropdown / select
        document.querySelectorAll('select').forEach(sel => {
            const label = getLabelFor(sel);
            if (label && label.toLowerCase().includes('medical centre')) {
                const option = [...sel.options].find(o =>
                    o.text.toLowerCase().includes('khatib')
                );
                if (option && sel.value !== option.value) {
                    sel.value = option.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }


    // ─── 2. Purpose ──────────────────────────────────────────────────────────


    function selectPurpose() {
        const routine = document.querySelector('input[type="radio"][value="Routine Daily Check"]');
        if (routine && !routine.checked) routine.click();
    }


    // ─── 3+4. Ambulance type + MID Number ────────────────────────────────────


    function selectAmbulance(type, mid) {
        selectRadioByValue(type);
        fillTextByLabel('ambulance mid', mid);
        fillTextByLabel('mid number', mid);
    }


    // ─── 5. All Yes options ───────────────────────────────────────────────────


    function clickYesOptions() {
        document.querySelectorAll('input[type="radio"][value="Yes"]').forEach(btn => {
            if (!btn.checked) btn.click();
        });
    }


    // ─── 6. AED Model → Defibtech Lifeline ───────────────────────────────────


    function selectAEDModel() {
        const TARGET = 'Defibtech Lifeline';


        // Native <select>
        document.querySelectorAll('select').forEach(sel => {
            const label = getLabelFor(sel);
            if (label && label.toLowerCase().includes('aed model')) {
                const option = [...sel.options].find(o =>
                    o.text.toLowerCase().includes(TARGET.toLowerCase())
                );
                if (option && sel.value !== option.value) {
                    sel.value = option.value;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });


        // Custom div/ul options
        document.querySelectorAll('[role="option"], li[data-value], .chakra-select__option').forEach(opt => {
            if (opt.textContent.trim().toLowerCase().includes(TARGET.toLowerCase())) {
                if (!opt.getAttribute('aria-selected')) opt.click();
            }
        });


        // Combobox
        document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]').forEach(box => {
            const label = getLabelFor(box);
            if (label && label.toLowerCase().includes('aed model')) {
                if (box.getAttribute('aria-expanded') !== 'true') box.click();
                setTimeout(() => {
                    const listbox = document.querySelector('[role="listbox"]');
                    if (listbox) {
                        const match = [...listbox.querySelectorAll('[role="option"]')]
                            .find(o => o.textContent.trim().toLowerCase().includes(TARGET.toLowerCase()));
                        if (match) match.click();
                    }
                }, 300);
            }
        });


        // Radio
        selectRadioByValue(TARGET);
    }


    // ─── Main loop ────────────────────────────────────────────────────────────


    function runAll() {
        clickYesOptions();
        fillMedicalCentre();
        selectPurpose();
        selectAEDModel();
    }


    function start() {
        if (running) return;
        running = true;
        interval = setInterval(runAll, 800);
        updateStartButton();
    }


    function stop() {
        running = false;
        clearInterval(interval);
        updateStartButton();
    }


    function toggle() {
        running ? stop() : start();
    }


    // ─── UI Panel ─────────────────────────────────────────────────────────────


    const panel = document.createElement('div');
    Object.assign(panel.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        alignItems: 'stretch',
        fontFamily: 'sans-serif',
    });


    function makeBtn(label, bg, onClick) {
        const btn = document.createElement('button');
        btn.innerText = label;
        Object.assign(btn.style, {
            padding: '11px 16px',
            background: bg,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
            textAlign: 'center',
            minWidth: '160px',
        });
        btn.addEventListener('click', onClick);
        return btn;
    }


    // ▶ Start / ⏹ Stop
    const startBtn = makeBtn('▶ Start Auto', '#00c853', toggle);


    function updateStartButton() {
        if (running) {
            startBtn.innerText = '⏹ Stop Auto';
            startBtn.style.background = '#d50000';
        } else {
            startBtn.innerText = '▶ Start Auto';
            startBtn.style.background = '#00c853';
        }
    }


    // 🚑 HSO → tick HSO radio + fill MID 46138
    const hsoBtn = makeBtn('🚑 HSO (46138)', '#1565c0', () => {
        selectAmbulance('HSO', '46138');
    });


    // 🚑 Tier 2 → tick Tier 2 radio + fill MID 46235
    const tier2Btn = makeBtn('🚑 Tier 2 (46235)', '#6a1b9a', () => {
        selectAmbulance('Tier 2', '46235');
    });


    panel.appendChild(startBtn);
    panel.appendChild(hsoBtn);
    panel.appendChild(tier2Btn);
    document.body.appendChild(panel);


})();
