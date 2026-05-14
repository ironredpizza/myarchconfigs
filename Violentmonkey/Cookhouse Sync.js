// ==UserScript==
// @name         eCookhouse Sheet sync
// @namespace    Violentmonkey Scripts
// @match        https://www.ns.gov.sg/web/portal/nsmen/home/dashboard/ecookhouse*
// @match        https://www.ns.gov.sg/eup/cookhouse*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// @connect      googleusercontent.com
// @version      6.20
// ==/UserScript==

(function() {
    'use strict';
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    let cancelled = false;
    const checkCancelled = () => {
        if (cancelled) throw new Error('CANCELLED');
    };

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 40px;
        z-index: 9999;
        width: 200px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: 'Inter', 'Roboto', system-ui, -apple-system, sans-serif;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
    `;
    document.body.appendChild(buttonContainer);

    function createBtn(text, bgColor, textColor, action) {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.cssText = `
            width: 100%;
            height: 48px;
            background: ${bgColor};
            color: ${textColor};
            border: none;
            border-radius: 12px;
            font-family: inherit;
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.5px;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.1s ease;
        `;
        btn.addEventListener('mouseenter', () => {
            btn.style.filter = 'brightness(1.05)';
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.filter = 'brightness(1)';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
        });
        buttonContainer.appendChild(btn);

        btn.onclick = async () => {
            if (btn.dataset.running === 'true') {
                cancelled = true;
                btn.innerHTML = text;
                btn.dataset.running = 'false';
                btn.style.opacity = '1';
                return;
            }
            cancelled = false;
            btn.dataset.running = 'true';
            btn.innerHTML = '✖ Cancel';
            btn.style.opacity = '0.85';
            try {
                await action();
            } catch (e) {
                if (e.message !== 'CANCELLED') console.error(e);
            } finally {
                btn.innerHTML = text;
                btn.dataset.running = 'false';
                btn.style.opacity = '1';
                cancelled = false;
            }
        };
    }

    const selectAntDropdown = (selectorId, searchText) => {
        return new Promise((resolve) => {
            const selector = document.querySelector(selectorId)?.closest('.ant-select-selector');
            if (!selector) return resolve();
            selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            let attempts = 0;
            const int = setInterval(() => {
                const opts = document.querySelectorAll('.ant-select-item-option');
                for (let o of opts) {
                    if (o.innerText.includes(searchText)) {
                        o.click();
                        clearInterval(int);
                        setTimeout(resolve, 50);
                        return;
                    }
                }
                if (++attempts > 15) { clearInterval(int); resolve(); }
            }, 80);
        });
    };

    const setReactInput = (input, value) => {
        if (!input) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const setStrength = async () => {
        const input = document.querySelector('input[id*="postedStrength"]');
        if (input) setReactInput(input, '39');
        await sleep(30);
    };

    const MEAL_CODES = { "07:00": "EB", "10:30": "L", "17:00": "D" };

    const dismissPicker = async () => {
        document.activeElement?.blur();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        document.body.click();
        await sleep(30);
    };

    const enforcePanels = async () => {
        const panels = document.querySelectorAll('.ant-collapse-item');
        if (panels.length > 0) {
            const first = panels[0];
            if (first.classList.contains('ant-collapse-item-active')) {
                first.querySelector('.ant-collapse-header')?.click();
                await sleep(50);
            }
        }
        if (panels.length > 1) {
            const second = panels[1];
            if (!second.classList.contains('ant-collapse-item-active')) {
                second.querySelector('.ant-collapse-header')?.click();
                await sleep(50);
            }
        }
    };

    const scrollSecondToTop = () => {
        const panels = document.querySelectorAll('.ant-collapse-item');
        if (panels.length > 1) {
            panels[1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => window.scrollBy({ top: -60, behavior: 'smooth' }), 80);
        }
    };

    const switchTab = async (nodeKey) => {
        const tab = document.querySelector(`.ant-tabs-tab[data-node-key="${nodeKey}"]`);
        if (tab) { tab.click(); await sleep(100); await enforcePanels(); }
    };

    const fillTimes = async (timeValue, customMealCode = null) => {
        checkCancelled();
        const mealCode = customMealCode ?? MEAL_CODES[timeValue];
        const allInputs = [...document.querySelectorAll('input[id^="formName_deliveryTime"]')];
        const inputs = mealCode ? allInputs.filter(i => i.id.includes(`_${mealCode}_`)) : allInputs;
        if (inputs.length === 0) return;

        for (let input of inputs) {
            checkCancelled();
            input.scrollIntoView({ block: 'center' });
            await sleep(20);
            input.focus();
            input.click();
            await sleep(40);
            setReactInput(input, timeValue);
            await sleep(20);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            await sleep(20);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            await sleep(20);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
            await sleep(20);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
            await sleep(30);
            if (input.value !== timeValue) {
                setReactInput(input, timeValue);
                await sleep(20);
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                await sleep(20);
            }
        }

        const qtyInputs = [...document.querySelectorAll('input[id*="NON_MUSLIM"]')];
        const filteredQty = mealCode ? qtyInputs.filter(i => i.id.includes(`_${mealCode}_`)) : qtyInputs;
        filteredQty.forEach(i => setReactInput(i, '1'));
        await dismissPicker();
    };

    const fillAllMeals = async () => {
        await switchTab('EB'); await fillTimes("07:00"); checkCancelled();
        await switchTab('L');  await fillTimes("10:30"); checkCancelled();
        await switchTab('D');  await fillTimes("17:00"); checkCancelled();
        await switchTab('NS3'); await fillTimes("17:00", "NS3"); checkCancelled();
        await switchTab('NS4'); await fillTimes("17:00", "NS4");
        await dismissPicker();
        await switchTab('EB');
        scrollSecondToTop();
        console.log('All meals done (fast mode)!');
    };

    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJAT7i_LJ3R5asuBQ6bHslckUnzGqLUs-Zyxxh03GOIQcRhw02b0SXjZS_XbXBl_Pl7zNzSxqS9yWd/pub?gid=362337945&single=true&output=csv';

    function showToast(msg, isError = false) {
        const existing = document.getElementById('__eco_toast__');
        if (existing) existing.remove();
        const t = document.createElement('div');
        t.id = '__eco_toast__';
        t.style.cssText = `
            position:fixed;bottom:30px;left:50%;transform:translateX(-50%);
            z-index:99999;padding:12px 22px;border-radius:10px;font-size:14px;
            font-weight:600;color:white;font-family:Inter,system-ui,sans-serif;
            background:${isError ? '#c0392b' : '#27ae60'};
            box-shadow:0 4px 16px rgba(0,0,0,0.2);
            opacity:1;max-width:480px;text-align:center;
            white-space:pre-line;line-height:1.6;transition:opacity 0.4s;
        `;
        t.innerText = msg;
        document.body.appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 5000);
    }

    function fetchCSV() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: CSV_URL,
                onload: (res) => resolve(res.responseText),
                onerror: (err) => reject(err)
            });
        });
    }

    function parseCSV(text) {
        return text.split('\n').map(row => {
            const cols = [];
            let cur = '', inQuote = false;
            for (let ch of row) {
                if (ch === '"') { inQuote = !inQuote; }
                else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
                else { cur += ch; }
            }
            cols.push(cur.trim());
            return cols;
        });
    }

    function formDateToSheetHeader(ddmmyyyy) {
        const [dd, mm] = ddmmyyyy.split('/');
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`;
    }

    function getDatesFromForm() {
        const dateSet = new Set();
        document.querySelectorAll('input[id*="indentQty"]').forEach(inp => {
            const match = inp.id.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (match) dateSet.add(match[1]);
        });
        return [...dateSet].sort();
    }

    function findColIndex(headerRow, sheetHeader) {
        for (let i = 0; i < headerRow.length; i++) {
            if (headerRow[i].trim().toLowerCase() === sheetHeader.toLowerCase()) return i;
        }
        return -1;
    }

    function extractSheetValues(rows, colIndex) {
        const result = { minus: null, totalVeg: null, totalSD: null };
        for (let row of rows) {
            const label = row[1]?.trim().toLowerCase();
            const val = row[colIndex]?.trim().replace(/,/g, '') || '';
            if (label === 'minus'     && result.minus    === null) result.minus    = val;
            if (label === 'total veg' && result.totalVeg === null) result.totalVeg = val;
            if (label === 'total sd'  && result.totalSD  === null) result.totalSD  = val;
        }
        return result;
    }

    // Flexible filling: tries multiple type patterns (e.g., '_MUSLIM_O', '_MUSLIM')
    function fillForMeal(value, formDate, mealCode, typePatterns = ['_MUSLIM_O']) {
        if (!value || value === '') return 0;
        let filled = 0;
        for (let pattern of typePatterns) {
            const inputs = [...document.querySelectorAll('input[id*="indentQty"]')]
                .filter(i => i.id.includes(pattern) && i.id.includes(formDate) && i.id.includes(`_${mealCode}_`));
            if (inputs.length) {
                inputs.forEach(i => setReactInput(i, value));
                filled = inputs.length;
                console.log(`✅ Filled ${mealCode} with pattern ${pattern}: ${value} (${filled} inputs)`);
                break; // stop after first successful pattern
            } else {
                console.log(`⚠️ No input found for ${mealCode} with pattern ${pattern}`);
            }
        }
        return filled;
    }

    const syncSheet = async () => {
        const formDates = getDatesFromForm();
        if (formDates.length === 0) {
            showToast('❌ No dates found in form.\nLoad the meal indent table first.', true);
            return;
        }
        showToast('⏳ Fetching sheet…');
        let csvText;
        try { csvText = await fetchCSV(); }
        catch (e) { showToast('❌ Failed to fetch CSV.', true); return; }

        const rows = parseCSV(csvText);
        if (!rows.length) { showToast('❌ CSV empty.', true); return; }

        const headerRow = rows[0];
        const results = [];
        let anyFilled = false;

        for (const formDate of formDates) {
            const sheetHeader = formDateToSheetHeader(formDate);
            const colIndex = findColIndex(headerRow, sheetHeader);
            if (colIndex === -1) {
                results.push(`⚠️ ${sheetHeader}: not in sheet`);
                continue;
            }

            // --- LUNCH (uses existing rows: minus, total veg, total SD) ---
            const { minus, totalVeg, totalSD } = extractSheetValues(rows, colIndex);
            const lunchMuslim = fillForMeal(minus, formDate, 'L', ['_MUSLIM_O']);
            const lunchVeg    = fillForMeal(totalVeg, formDate, 'L', ['_VEGETARIAN INDIAN_O']);
            const lunchSD     = fillForMeal(totalSD, formDate, 'L', ['_SPECIAL DIET MUSLIM_O']);

            // --- BREAKFAST (EB) from "Total Muslim Breakfast" ---
            let breakfastVal = '';
            for (let row of rows) {
                const label = row[1]?.trim().toLowerCase();
                if (label === 'total muslim breakfast') {
                    breakfastVal = row[colIndex]?.trim().replace(/,/g, '') || '';
                    break;
                }
            }
            const breakfastFilled = fillForMeal(breakfastVal, formDate, 'EB', ['_MUSLIM_O']);

            // --- DINNER (D) from "Total Muslim Dinner" ---
            let dinnerVal = '';
            for (let row of rows) {
                const label = row[1]?.trim().toLowerCase();
                if (label === 'total muslim dinner') {
                    dinnerVal = row[colIndex]?.trim().replace(/,/g, '') || '';
                    break;
                }
            }
            const dinnerFilled = fillForMeal(dinnerVal, formDate, 'D', ['_MUSLIM_O']);

            // --- REDUCED NIGHTSNACK 1 (NS3) - try multiple patterns ---
            let ns1Val = '';
            for (let row of rows) {
                const label = row[1]?.trim().toLowerCase();
                if (label === 'reduced nightsnack 1') {
                    ns1Val = row[colIndex]?.trim().replace(/,/g, '') || '';
                    break;
                }
            }
            // Try '_MUSLIM_O' first, then '_MUSLIM', then any (excluding NON_MUSLIM)
            const ns1Filled = fillForMeal(ns1Val, formDate, 'NS3', ['_MUSLIM_O', '_MUSLIM']);

            // --- REDUCED NIGHTSNACK 2 (NS4) ---
            let ns2Val = '';
            for (let row of rows) {
                const label = row[1]?.trim().toLowerCase();
                if (label === 'reduced nightsnack 2') {
                    ns2Val = row[colIndex]?.trim().replace(/,/g, '') || '';
                    break;
                }
            }
            const ns2Filled = fillForMeal(ns2Val, formDate, 'NS4', ['_MUSLIM_O', '_MUSLIM']);

            results.push(`${sheetHeader}:
  Lunch  → M=${minus}(${lunchMuslim}) V=${totalVeg}(${lunchVeg}) SD=${totalSD}(${lunchSD})
  Breakfast → M=${breakfastVal}(${breakfastFilled})
  Dinner   → M=${dinnerVal}(${dinnerFilled})
  NS1      → M=${ns1Val}(${ns1Filled})
  NS2      → M=${ns2Val}(${ns2Filled})`);

            anyFilled = true;
        }

        showToast(
            anyFilled ? '✅ Sheet Sync done (all meals)!\n' + results.join('\n\n')
                      : '❌ No dates matched.\n' + results.join('\n'),
            !anyFilled
        );
    };

    createBtn('1. Camp & Date', '#CC1E2C', '#FFFFFF', async () => {
        const menuItems = [...document.querySelectorAll('li.ant-menu-item')];
        const weeklyIndent = menuItems.find(el => el.getAttribute('data-menu-id')?.includes('weeklyMealIndent'));
        if (weeklyIndent) { weeklyIndent.click(); await sleep(300); }
        await selectAntDropdown('#formName_cookhouseCd', 'KHATIB CAMP (BLK 6)');
        const dateInput = document.querySelector('#formName_startDate');
        const valueBefore = dateInput?.getAttribute('value') || dateInput?.value || '';
        dateInput?.click();
        for (let t = 0; t < 50; t++) {
            await sleep(50);
            const current = document.querySelector('#formName_startDate');
            const val = current?.getAttribute('value') || current?.value || '';
            if (val.trim() !== '' && val !== valueBefore) {
                await sleep(150);
                const searchBtn = [...document.querySelectorAll('button.ant-btn-primary')]
                    .find(b => b.innerText.trim() === 'Search');
                if (searchBtn) searchBtn.click();
                break;
            }
        }
    });

    createBtn('2. Auto Fill', '#475569', '#F8FAFC', async () => {
        const searchBtn = [...document.querySelectorAll('button.ant-btn-primary')]
            .find(b => b.innerText.trim() === 'Search' || b.textContent.trim() === 'Search');
        if (searchBtn) { searchBtn.click(); await sleep(500); }
        await sleep(200);
        await selectAntDropdown('#formName_unitCd', 'S32B');
        await selectAntDropdown('#formName_viewType', 'By Meal Type');
        await setStrength();
        const specialLabel = Array.from(document.querySelectorAll('label.ant-checkbox-wrapper'))
            .find(label => label.textContent.includes('special diet'));
        if (specialLabel) {
            const checkbox = specialLabel.querySelector('.ant-checkbox');
            if (checkbox && !checkbox.classList.contains('ant-checkbox-checked')) {
                checkbox.click();
                await sleep(80);
            }
        }
    });

    createBtn('🍱 All Meals', '#0D9488', '#FFFFFF', () => fillAllMeals());
    createBtn('📊 Sheet Sync', '#8e44ad', '#FFFFFF', () => syncSheet());

})();
