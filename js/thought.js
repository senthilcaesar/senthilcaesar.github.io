// --- FOOD FOR THOUGHT OF THE DAY ---
// Reads data/sayings.txt, picks one saying per calendar day, and types it out
// in a drawer that slides in from the right.
//
// The file is read fresh on every visit, so new sayings appear without any code
// change. The day's pick comes from a shuffled order seeded by the date: every
// visitor sees the same saying on the same day, and no saying repeats until the
// whole list has been shown once.
(function () {
    const tab = document.getElementById('thought-tab');
    const drawer = document.getElementById('thought-drawer');
    const backdrop = document.getElementById('thought-backdrop');
    if (!tab || !drawer || !backdrop) return;

    const closeBtn = document.getElementById('thought-close');
    const dateEl = document.getElementById('thought-date');
    const textEl = document.getElementById('thought-text');
    const authorEl = document.getElementById('thought-author');
    const countdownEl = document.getElementById('thought-countdown');
    const replayBtn = document.getElementById('thought-replay');
    const copyBtn = document.getElementById('thought-copy');
    const quoteEl = drawer.querySelector('.thought-quote');

    const SOURCE = 'data/sayings.txt';
    const CACHE_KEY = 'thoughtOfTheDay';
    const SEEN_KEY = 'thoughtSeenOn';
    const TYPED_KEY = 'thoughtTypedOn';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let saying = null;
    let typedThisVisit = null; // backup for browsers that block storage
    let typingTimer = null;
    let countdownTimer = null;
    let lastFocus = null;

    // --- Dates ---------------------------------------------------------------
    function todayKey(d = new Date()) {
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
    }

    // Whole days since 1 Jan 1970 in the visitor's own time zone
    function dayNumber(d = new Date()) {
        return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    }

    function storageGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    function storageSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }

    // --- Parsing -------------------------------------------------------------
    // Each saying is a block separated by blank lines, optionally numbered
    // ("12. "), with the author after the last spaced dash ("... - Aristotle").
    function parseSayings(raw) {
        return raw
            .replace(/^﻿/, '')
            .replace(/\r\n?/g, '\n')
            .split(/\n\s*\n/)
            .map(block => block.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .map(block => {
                const body = block.replace(/^\d+[.)]\s*/, '');
                const match = body.match(/^(.*\S)\s+[-–—]\s+([^-–—]+)$/);
                if (match) {
                    const author = match[2].trim();
                    // A real name is short; anything longer is part of the saying
                    if (author.split(/\s+/).length <= 8 && author.length <= 64) {
                        return { text: match[1].trim(), author };
                    }
                }
                return { text: body, author: '' };
            })
            .filter(s => s.text.length > 0);
    }

    // --- Daily pick ----------------------------------------------------------
    function mulberry32(seed) {
        return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function pickForToday(list) {
        const n = list.length;
        const day = dayNumber();
        const cycle = Math.floor(day / n);
        const rand = mulberry32(cycle * 7919 + n);
        const order = list.map((_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        return list[order[day % n]];
    }

    // Keep the day's saying stable even if the file is edited mid-day
    async function loadToday() {
        const today = todayKey();
        try {
            const cached = JSON.parse(storageGet(CACHE_KEY) || 'null');
            if (cached && cached.date === today && cached.text) return cached;
        } catch (e) { /* ignore a corrupt cache */ }

        const res = await fetch(SOURCE, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Could not load ${SOURCE}`);
        const list = parseSayings(await res.text());
        if (!list.length) throw new Error('No sayings found');

        const pick = { date: today, ...pickForToday(list) };
        storageSet(CACHE_KEY, JSON.stringify(pick));
        return pick;
    }

    // --- Typewriter ----------------------------------------------------------
    // Speed adapts to length so long sayings still finish in about 15 seconds.
    // Punctuation gets a breath, the way someone reading aloud would pause.
    function typeSaying(text, onDone) {
        clearTimeout(typingTimer);
        textEl.textContent = '';
        textEl.classList.add('is-typing');

        if (reduceMotion) {
            textEl.textContent = text;
            textEl.classList.remove('is-typing');
            onDone();
            return;
        }

        const base = Math.max(18, Math.min(52, 13000 / text.length));
        let i = 0;

        function next() {
            if (i >= text.length) {
                textEl.classList.remove('is-typing');
                onDone();
                return;
            }
            const ch = text[i++];
            textEl.textContent = text.slice(0, i);

            let delay = base * (0.6 + Math.random() * 0.8);
            if (/[.!?]/.test(ch)) delay += 520;
            else if (/[,;:]/.test(ch)) delay += 260;
            else if (ch === ' ' && Math.random() < 0.05) delay += 180;
            typingTimer = setTimeout(next, delay);
        }

        typingTimer = setTimeout(next, 900);
    }

    function finishTypingNow() {
        if (!saying || !textEl.classList.contains('is-typing')) return;
        clearTimeout(typingTimer);
        textEl.textContent = saying.text;
        textEl.classList.remove('is-typing');
        revealAfter();
    }

    function revealAfter() {
        drawer.classList.add('is-revealed');
    }

    function play() {
        drawer.classList.remove('is-revealed');
        authorEl.textContent = saying.author ? saying.author : 'Unknown';
        storageSet(TYPED_KEY, saying.date);
        typedThisVisit = saying.date;
        typeSaying(saying.text, revealAfter);
    }

    // Show the saying complete, with no typing (for every opening after the first)
    function showWhole() {
        clearTimeout(typingTimer);
        authorEl.textContent = saying.author ? saying.author : 'Unknown';
        textEl.textContent = saying.text;
        textEl.classList.remove('is-typing');
        revealAfter();
    }

    // --- Countdown to tomorrow's thought --------------------------------------
    function updateCountdown() {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const mins = Math.max(1, Math.ceil((midnight - now) / 60000));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        countdownEl.textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;

        // The drawer was left open past midnight: bring in the new day's thought
        if (saying && saying.date !== todayKey()) {
            loadToday().then(s => { saying = s; play(); }).catch(() => {});
        }
    }

    // --- Open / close --------------------------------------------------------
    async function open() {
        if (typeof window.closeMobileMenu === 'function') window.closeMobileMenu();
        lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : tab;

        dateEl.textContent = new Date().toLocaleDateString(undefined, {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        backdrop.classList.add('is-open');
        drawer.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.removeAttribute('inert');
        tab.setAttribute('aria-expanded', 'true');
        document.body.classList.add('thought-open');
        closeBtn.focus({ preventScroll: true });

        storageSet(SEEN_KEY, todayKey());
        tab.classList.add('is-seen');

        updateCountdown();
        clearInterval(countdownTimer);
        countdownTimer = setInterval(updateCountdown, 30000);

        try {
            saying = await loadToday();
            drawer.classList.remove('is-error');
            // The typewriter plays once a day; after that the saying is simply there.
            // "Read again" still types it out on request.
            const alreadyTyped = storageGet(TYPED_KEY) === saying.date || typedThisVisit === saying.date;
            if (alreadyTyped) showWhole();
            else play();
        } catch (e) {
            drawer.classList.add('is-error');
            textEl.textContent = 'Today’s thought is still on its way. Please check back in a little while.';
            authorEl.textContent = '';
        }
    }

    function close() {
        clearTimeout(typingTimer);
        clearInterval(countdownTimer);
        backdrop.classList.remove('is-open');
        drawer.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');
        tab.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('thought-open');
        if (lastFocus) lastFocus.focus({ preventScroll: true });
    }

    function isOpen() {
        return drawer.classList.contains('is-open');
    }

    tab.addEventListener('click', e => {
        e.stopPropagation();
        isOpen() ? close() : open();
    });
    closeBtn.addEventListener('click', close);
    // Close on a click in the dimmed area, not on clicks inside the drawer
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) close();
    });

    // A click on the saying while it types shows the rest at once
    quoteEl.addEventListener('click', finishTypingNow);

    replayBtn.addEventListener('click', () => { if (saying) play(); });

    copyBtn.addEventListener('click', async () => {
        if (!saying) return;
        const line = saying.author ? `“${saying.text}” — ${saying.author}` : `“${saying.text}”`;
        try {
            await navigator.clipboard.writeText(line);
            copyBtn.classList.add('is-done');
            copyBtn.querySelector('span').textContent = 'Copied';
            setTimeout(() => {
                copyBtn.classList.remove('is-done');
                copyBtn.querySelector('span').textContent = 'Copy';
            }, 1800);
        } catch (e) { /* clipboard blocked */ }
    });

    // --- Tab entrance ----------------------------------------------------------
    // Keep the tab tucked just under the header at every screen size
    const header = document.querySelector('header');
    function placeTab() {
        if (!header) return;
        const h = Math.round(header.getBoundingClientRect().height);
        document.documentElement.style.setProperty('--thought-header-h', `${h}px`);
    }
    placeTab();
    if (header && 'ResizeObserver' in window) new ResizeObserver(placeTab).observe(header);
    else window.addEventListener('resize', placeTab);

    if (storageGet(SEEN_KEY) === todayKey()) tab.classList.add('is-seen');
    // The tab drifts in only after the greeting typewriter has finished typing
    // the name. Until today's thought has been opened, it glows softly.
    // It listens for the typewriter's signal, also watches the greeting itself
    // (so a cached older main.js can't keep it hidden), and as a last resort
    // shows up after 15 seconds no matter what.
    let shown = false;
    function showTab() {
        if (shown) return;
        shown = true;
        if (greetingWatch) greetingWatch.disconnect();
        clearTimeout(fallbackTimer);
        setTimeout(() => tab.classList.add('is-visible'), reduceMotion ? 0 : 900);
    }

    const greeting = document.getElementById('bio-greeting');
    function greetingFinished() {
        if (!greeting) return true;
        const typed = greeting.querySelectorAll('.tw-char');
        // Characters appear once the typewriter starts; done when none are hidden
        return typed.length > 0 && !greeting.querySelector('.tw-char.tw-hidden');
    }

    let greetingWatch = null;
    const fallbackTimer = setTimeout(showTab, 15000);
    document.addEventListener('greeting:typed', showTab, { once: true });

    if (window.greetingTyped || reduceMotion || greetingFinished()) {
        showTab();
    } else if (greeting && 'MutationObserver' in window) {
        greetingWatch = new MutationObserver(() => { if (greetingFinished()) showTab(); });
        greetingWatch.observe(greeting, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }

    window.openThought = open;
})();
