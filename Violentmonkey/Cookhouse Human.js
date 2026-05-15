// ==UserScript==
// @name         eCookhouse Sheet sync
// @namespace    Violentmonkey Scripts
// @match        https://www.ns.gov.sg/web/portal/nsmen/home/dashboard/ecookhouse*
// @match        https://www.ns.gov.sg/eup/cookhouse*
// @grant        GM_xmlhttpRequest
// @connect      docs.google.com
// @connect      googleusercontent.com
// @version      6.29
// ==/UserScript==

(function() {
    'use strict';

    // ── Speed control ─────────────────────────────────────────────────────────
    const SPEED = 0.20;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms * SPEED));
    const humanDelay = (base) => sleep(base * (0.8 + Math.random() * 0.4));

    const humanMouseMove = (el) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width  * (0.3 + Math.random() * 0.4);
        const y = rect.top  + rect.height * (0.3 + Math.random() * 0.4);
        el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: x, clientY: y }));
        el.dispatchEvent(new MouseEvent('mouseover',  { bubbles: true, clientX: x, clientY: y }));
    };

    const humanClick = async (el) => {
        if (!el) return;
        humanMouseMove(el);
        await humanDelay(60);
        const rect = el.getBoundingClientRect();
        const x = rect.left + rect.width  * (0.3 + Math.random() * 0.4);
        const y = rect.top  + rect.height * (0.3 + Math.random() * 0.4);
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
        await humanDelay(40);
        el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, clientX: x, clientY: y }));
        await humanDelay(20);
        el.click();
        await humanDelay(80);
    };

    const humanType = async (input, value) => {
        if (!input) return;
        input.focus();
        await humanDelay(80);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
        await humanDelay(30);
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await humanDelay(40);
        for (const ch of String(value)) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
            nativeSetter.call(input, input.value + ch);
            input.dispatchEvent(new Event('input',           { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup',   { key: ch, bubbles: true }));
            await sleep(30 + Math.random() * 60);
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await humanDelay(60);
    };

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
        return new Promise(async (resolve) => {
            const selector = document.querySelector(selectorId)?.closest('.ant-select-selector');
            if (!selector) return resolve();
            humanMouseMove(selector);
            await humanDelay(80);
            selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            await humanDelay(50);
            let attempts = 0;
            const int = setInterval(async () => {
                const opts = document.querySelectorAll('.ant-select-item-option');
                for (let o of opts) {
                    if (o.innerText.includes(searchText)) {
                        humanMouseMove(o);
                        await humanDelay(60);
                        o.click();
                        clearInterval(int);
                        setTimeout(resolve, 80 + Math.random() * 60);
                        return;
                    }
                }
                if (++attempts > 15) { clearInterval(int); resolve(); }
            }, 100);
        });
    };

    const setReactInput = (input, value) => {
        if (!input) return;
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    function computePeakLunchStrength() {
        const allInputs = [...document.querySelectorAll('input[id*="indentQty"]')]
            .filter(i => i.id.includes('_L_'));
        const byDate = {};
        for (const inp of allInputs) {
            const dateMatch = inp.id.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (!dateMatch) continue;
            const date = dateMatch[1];
            if (!byDate[date]) byDate[date] = 0;
            const isMuslim = inp.id.includes('_MUSLIM_O') && !inp.id.includes('SPECIAL');
            const isVeg    = inp.id.includes('_VEGETARIAN');
            const isSD     = inp.id.includes('_SPECIAL DIET MUSLIM');
            if (isMuslim || isVeg || isSD) {
                const val = parseInt(inp.value, 10) || 0;
                byDate[date] += val;
            }
        }
        const dates = Object.keys(byDate);
        if (dates.length === 0) return null;
        let peakDate = dates[0], peakVal = byDate[dates[0]];
        for (const d of dates) {
            if (byDate[d] > peakVal) { peakVal = byDate[d]; peakDate = d; }
        }
        console.log('Peak lunch strength:', peakVal, 'on', peakDate, '| all dates:', byDate);
        return peakVal > 0 ? String(peakVal) : null;
    }

    const setStrengthHuman = async (value = '39') => {
        const input = document.querySelector('input[id*="postedStrength"]');
        if (input) await humanType(input, value);
        await humanDelay(50);
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
            await humanDelay(120);
            humanMouseMove(input);
            await humanDelay(70);
            input.focus();
            await humanDelay(50);
            input.click();
            await humanDelay(60);
            await humanType(input, timeValue);
            await humanDelay(80);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            await humanDelay(50);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
            await humanDelay(40);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
            await humanDelay(40);
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
            await humanDelay(60);
            if (input.value !== timeValue) {
                console.warn(`Retry filling ${input.id}`);
                await humanType(input, timeValue);
                await humanDelay(60);
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                await humanDelay(50);
            }
        }

        const qtyInputs = [...document.querySelectorAll('input[id*="NON_MUSLIM"]')];
        const filteredQty = mealCode ? qtyInputs.filter(i => i.id.includes(`_${mealCode}_`)) : qtyInputs;
        filteredQty.forEach(i => setReactInput(i, '1'));
        await dismissPicker();
    };

    const fillAllMeals = async () => {
        await switchTab('EB');
        await humanDelay(200);
        await fillTimes("07:00");
        checkCancelled();

        await humanDelay(300 + Math.random() * 150);
        await switchTab('L');
        await humanDelay(200);
        await fillTimes("10:30");
        checkCancelled();

        await humanDelay(300 + Math.random() * 150);
        await switchTab('D');
        await humanDelay(200);
        await fillTimes("17:00");
        checkCancelled();

        await humanDelay(300 + Math.random() * 150);
        await switchTab('NS3');
        await humanDelay(200);
        await fillTimes("17:00", "NS3");
        checkCancelled();

        await humanDelay(300 + Math.random() * 150);
        await switchTab('NS4');
        await humanDelay(200);
        await fillTimes("17:00", "NS4");

        await dismissPicker();
        await humanDelay(150);
        await switchTab('EB');
        scrollSecondToTop();
        console.log('All meals done!');
    };

    // ── Sheet auto-detection (FAST: parallel fetch, single index pass) ────────
    const SHEET_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJAT7i_LJ3R5asuBQ6bHslckUnzGqLUs-Zyxxh03GOIQcRhw02b0SXjZS_XbXBl_Pl7zNzSxqS9yWd/pub';

    // header (normalised) → { gid, rows }  — built once per sync run
    const sheetIndex = {};

    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload:  (res) => resolve(res.responseText),
                onerror: (err) => reject(err)
            });
        });
    }

    // ── Header normalisation ──────────────────────────────────────────────────
    function normaliseHeader(str) {
        return str
            .replace(/[\u00A0\u200B\uFEFF\u200C\u200D]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    // ── Extract every unique gid from the published HTML ─────────────────────
    function extractGidsFromHtml(html) {
        const seen = new Set(['0']); // gid=0 always exists
        for (const m of html.matchAll(/gid=(\d+)/g))           seen.add(m[1]);
        for (const m of html.matchAll(/"sheetId"\s*:\s*(\d+)/g)) seen.add(m[1]);
        return [...seen];
    }

    // ── Build full index: fetch ALL tabs in parallel, one pass ───────────────
    async function buildSheetIndex() {
        showToast('⏳ Loading sheets…');
        // Clear stale index
        for (const k of Object.keys(sheetIndex)) delete sheetIndex[k];

        const html = await gmFetch(`${SHEET_BASE}?output=html`);
        const gids = extractGidsFromHtml(html);
        console.log(`Fetching ${gids.length} tab(s) in parallel:`, gids.join(', '));

        const fetches = gids.map(gid =>
            gmFetch(`${SHEET_BASE}?gid=${gid}&single=true&output=csv`)
                .then(csv => ({ gid, rows: parseCSV(csv) }))
                .catch(e => { console.warn(`gid=${gid} failed:`, e); return null; })
        );
        const results = (await Promise.all(fetches)).filter(Boolean);

        for (const { gid, rows } of results) {
            const headerRow = rows[0] ?? [];
            headerRow.forEach(cell => {
                const key = normaliseHeader(cell);
                if (key) sheetIndex[key] = { gid, rows };
            });
            console.log(`gid=${gid} headers:`, headerRow.map(h => `"${h}"`).slice(0, 12).join(', '));
        }
        console.log(`Index ready — ${Object.keys(sheetIndex).length} keys from ${results.length} tab(s).`);
    }

    // ── Date header helpers ───────────────────────────────────────────────────
    function formDateToSheetHeader(ddmmyyyy, longMonth = false) {
        const [dd, mm] = ddmmyyyy.split('/');
        const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const long  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const idx = parseInt(mm, 10) - 1;
        return `${parseInt(dd, 10)} ${longMonth ? long[idx] : short[idx]}`;
    }

    function candidateHeaders(formDate) {
        const [dd, mm] = formDate.split('/');
        const short = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const long  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const idx = parseInt(mm, 10) - 1;
        const day = parseInt(dd, 10);
        return [
            `${day} ${short[idx]}`,
            `${day} ${long[idx]}`,
            `${String(day).padStart(2,'0')} ${short[idx]}`,
            `${String(day).padStart(2,'0')} ${long[idx]}`,
            `${day}/${parseInt(mm, 10)}`,
            `${dd}/${mm}`,
        ];
    }

    // Pure lookup — no network, index already built
    function resolveDate(formDate) {
        for (const header of candidateHeaders(formDate)) {
            const entry = sheetIndex[normaliseHeader(header)];
            if (entry) return { gid: entry.gid, rows: entry.rows, sheetHeader: header };
        }
        return { gid: null, rows: null, sheetHeader: candidateHeaders(formDate)[0] };
    }

    // ── CSV helpers ───────────────────────────────────────────────────────────
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

    function getDatesFromForm() {
        const dateSet = new Set();
        document.querySelectorAll('input[id*="indentQty"]').forEach(inp => {
            const match = inp.id.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (match) dateSet.add(match[1]);
        });
        return [...dateSet].sort();
    }

    function findColIndex(headerRow, sheetHeader) {
        const key = normaliseHeader(sheetHeader);
        for (let i = 0; i < headerRow.length; i++) {
            if (normaliseHeader(headerRow[i]) === key) return i;
        }
        // Partial match fallback: header cell starts with the key
        for (let i = 0; i < headerRow.length; i++) {
            if (normaliseHeader(headerRow[i]).startsWith(key)) return i;
        }
        return -1;
    }

    function extractSheetValues(rows, colIndex) {
        const result = { minus: null, totalVeg: null, totalSD: null };
        for (let row of rows) {
            const label = normaliseHeader(row[1] ?? '');
            const val = row[colIndex]?.trim().replace(/,/g, '') || '';
            if (label === 'total muslim' && result.minus === null) result.minus = val;
            if (label === 'total veg' && result.totalVeg === null) result.totalVeg = val;
            if (label === 'total sd'  && result.totalSD  === null) result.totalSD  = val;
        }
        return result;
    }

    const fillForMeal = async (value, formDate, mealCode, typePatterns = ['_MUSLIM_O']) => {
        if (!value || value === '') return 0;
        let filled = 0;
        for (let pattern of typePatterns) {
            const inputs = [...document.querySelectorAll('input[id*="indentQty"]')]
                .filter(i => i.id.includes(pattern) && i.id.includes(formDate) && i.id.includes(`_${mealCode}_`));
            if (inputs.length) {
                for (const inp of inputs) {
                    checkCancelled();
                    inp.scrollIntoView({ block: 'center' });
                    await humanDelay(100);
                    humanMouseMove(inp);
                    await humanDelay(60);
                    await humanType(inp, value);
                    await humanDelay(80);
                    filled++;
                }
                console.log(`Filled ${mealCode} with pattern ${pattern}: ${value} (${filled} inputs)`);
                break;
            } else {
                console.log(`No input found for ${mealCode} with pattern ${pattern}`);
            }
        }
        return filled;
    };

    // ── Sheet Sync ────────────────────────────────────────────────────────────
    const syncSheet = async () => {
        const formDates = getDatesFromForm();
        if (formDates.length === 0) {
            showToast('❌ No dates found in form.\nLoad the meal indent table first.', true);
            return;
        }

        // One parallel fetch upfront — all tabs loaded simultaneously
        await buildSheetIndex();
        checkCancelled();

        const results = [];
        let anyFilled = false;

        for (const formDate of formDates) {
            checkCancelled();

            const { gid, rows, sheetHeader } = resolveDate(formDate);

            if (!gid) {
                console.warn(`No match for "${formDate}". Tried:`, candidateHeaders(formDate));
                results.push(`⚠️ ${formDateToSheetHeader(formDate)}: not found in any tab`);
                continue;
            }

            const headerRow = rows[0];
            const colIndex = findColIndex(headerRow, sheetHeader);
            if (colIndex === -1) {
                console.warn(`Column "${sheetHeader}" not found. Headers:`, headerRow.map(h => `"${h}"`).join(', '));
                results.push(`⚠️ ${sheetHeader}: column not found`);
                continue;
            }

            const { minus, totalVeg, totalSD } = extractSheetValues(rows, colIndex);
            const lunchMuslim = await fillForMeal(minus,    formDate, 'L', ['_MUSLIM_O']);
            const lunchVeg    = await fillForMeal(totalVeg, formDate, 'L', ['_VEGETARIAN INDIAN_O']);
            const lunchSD     = await fillForMeal(totalSD,  formDate, 'L', ['_SPECIAL DIET MUSLIM_O']);

            const getVal = (label) => {
                const normLabel = normaliseHeader(label);
                for (let row of rows) {
                    if (normaliseHeader(row[1] ?? '') === normLabel)
                        return row[colIndex]?.trim().replace(/,/g, '') || '';
                }
                return '';
            };

            const breakfastVal = getVal('total muslim breakfast');
            const dinnerVal    = getVal('total muslim dinner');
            const ns1Val       = getVal('reduced nightsnack 1');
            const ns2Val       = getVal('reduced nightsnack 2');

            const breakfastFilled = await fillForMeal(breakfastVal, formDate, 'EB', ['_MUSLIM_O']);
            const dinnerFilled    = await fillForMeal(dinnerVal,    formDate, 'D',  ['_MUSLIM_O']);
            const ns1Filled       = await fillForMeal(ns1Val,       formDate, 'NS3', ['_MUSLIM_O', '_MUSLIM']);
            const ns2Filled       = await fillForMeal(ns2Val,       formDate, 'NS4', ['_MUSLIM_O', '_MUSLIM']);

            results.push(`${sheetHeader}:
  Lunch  → M=${minus}(${lunchMuslim}) V=${totalVeg}(${lunchVeg}) SD=${totalSD}(${lunchSD})
  Breakfast → M=${breakfastVal}(${breakfastFilled})
  Dinner   → M=${dinnerVal}(${dinnerFilled})
  NS1      → M=${ns1Val}(${ns1Filled})
  NS2      → M=${ns2Val}(${ns2Filled})`);

            anyFilled = true;
        }

        showToast(
            anyFilled ? '✅ Sheet Sync done!\n' + results.join('\n\n')
                      : '❌ No dates matched.\n' + results.join('\n'),
            !anyFilled
        );
    };

    // ── Buttons ───────────────────────────────────────────────────────────────
    createBtn('1. Camp & Date', '#CC1E2C', '#FFFFFF', async () => {
        const menuItems = [...document.querySelectorAll('li.ant-menu-item')];
        const weeklyIndent = menuItems.find(el => el.getAttribute('data-menu-id')?.includes('weeklyMealIndent'));
        if (weeklyIndent) {
            await humanClick(weeklyIndent);
            await humanDelay(400);
        }
        await humanDelay(120);
        await selectAntDropdown('#formName_cookhouseCd', 'KHATIB CAMP (BLK 6)');
        await humanDelay(200);
        const dateInput = document.querySelector('#formName_startDate');
        humanMouseMove(dateInput);
        await humanDelay(80);
        await humanClick(dateInput);
    });

    createBtn('2. Auto Fill', '#475569', '#F8FAFC', async () => {
        const searchBtn = [...document.querySelectorAll('button.ant-btn-primary')]
            .find(b => b.innerText.trim() === 'Search' || b.textContent.trim() === 'Search');
        if (searchBtn) {
            await humanClick(searchBtn);
            await humanDelay(600);
        }
        await humanDelay(250);
        await selectAntDropdown('#formName_unitCd', 'S32B');
        await humanDelay(180);
        await selectAntDropdown('#formName_viewType', 'By Meal Type');
        await humanDelay(200);
        const peakStrength = computePeakLunchStrength() ?? '39';
        console.log('Using posted strength:', peakStrength);
        await setStrengthHuman(peakStrength);
        await humanDelay(150);
        const specialLabel = Array.from(document.querySelectorAll('label.ant-checkbox-wrapper'))
            .find(label => label.textContent.includes('special diet'));
        if (specialLabel) {
            const checkbox = specialLabel.querySelector('.ant-checkbox');
            if (checkbox && !checkbox.classList.contains('ant-checkbox-checked')) {
                humanMouseMove(checkbox);
                await humanDelay(70);
                await humanClick(checkbox);
                await humanDelay(100);
            }
        }
    });

    createBtn('🍱 All Meals', '#0D9488', '#FFFFFF', () => fillAllMeals());
    createBtn('📊 Sheet Sync', '#8e44ad', '#FFFFFF', () => syncSheet());

})();
