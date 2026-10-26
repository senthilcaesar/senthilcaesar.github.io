// --- THEME CONTROLLER ---
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;

function updateThemeIcon(isDark) {
    if (isDark) {
        themeToggle.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style="width: 20px; height: 20px;">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zM7.05 18.01c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06z"/>
            </svg>
        `;
    } else {
        themeToggle.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" style="width: 20px; height: 20px;">
                <path d="M12.3 22h-.1c-5.5 0-10-4.5-10-10 0-4.8 3.5-8.9 8.2-9.8.5-.1 1 .2 1.2.7.2.5 0 1.1-.4 1.4-2.8 1.9-4.3 5.3-3.6 8.7.7 3.5 3.6 6.1 7.2 6.4 1 .1 1.9-.2 2.7-.8.4-.3.9-.3 1.2.1.3.4.3.9 0 1.2-1.7 1.4-3.9 2.1-6.2 2.1z"/>
            </svg>
        `;
    }
}
window.updateThemeIcon = updateThemeIcon;

// Safe localStorage helper
function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
}

// Check for saved theme preference
const savedTheme = safeStorageGet('theme');
const themeManual = safeStorageGet('themeManual');

if (themeManual === 'true' && savedTheme) {
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
} else {
    // If no manual preference, default based on time of day (night = dark mode)
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour >= 18;
    if (isNight) {
        body.classList.add('dark-mode');
        updateThemeIcon(true);
    } else {
        body.classList.remove('dark-mode');
        updateThemeIcon(false);
    }
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        const isDark = body.classList.contains('dark-mode');
        updateThemeIcon(isDark);
        safeStorageSet('theme', isDark ? 'dark' : 'light');
        safeStorageSet('themeManual', 'true');

        // Trigger gear theme update if function exists
        if (typeof window.updateGearTheme === 'function') {
            window.updateGearTheme(isDark);
        }
    });
}

// --- NAVIGATION & INTERACTIVE CONTROLLERS ---
(function () {
    const navLinks = document.querySelectorAll('.header-middle .nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    if (!mobileToggle || !mobileOverlay) return;
    const hamburgerIcon = mobileToggle.querySelector('.hamburger-icon');
    const closeIcon = mobileToggle.querySelector('.close-icon');

    const sections = [
        { 
            id: 'about', 
            link: document.querySelector('.header-middle a[href="#about"]'),
            mobileLink: document.querySelector('.mobile-nav-link[href="#about"]')
        },
        { 
            id: 'quick-links', 
            link: document.querySelector('.header-middle a[href="#quick-links"]'),
            mobileLink: document.querySelector('.mobile-nav-link[href="#quick-links"]')
        },
        { 
            id: 'contact', 
            link: document.querySelector('.header-middle a[href="#contact"]'),
            mobileLink: document.querySelector('.mobile-nav-link[href="#contact"]')
        }
    ];

    const aboutSec = document.querySelector('.main-layout');
    if (aboutSec && !aboutSec.id) aboutSec.id = 'about';

    // Update dynamic footer year
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Update live Date & Day of Week displays (no time included)
    function updateDateDisplays() {
        const now = new Date();
        const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
        const monthLong = now.toLocaleDateString('en-US', { month: 'long' });
        const monthShort = now.toLocaleDateString('en-US', { month: 'short' });
        const dayNum = now.getDate();
        const year = now.getFullYear();

        const isoDate = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const accessibleLabel = `Today is ${dayOfWeek}, ${monthLong} ${dayNum}, ${year}`;

        const dateBadges = document.querySelectorAll('.header-date-badge, .mobile-date-badge, .sidebar-date-badge');
        dateBadges.forEach(badge => {
            if (badge.tagName.toLowerCase() === 'time') {
                badge.setAttribute('datetime', isoDate);
            }
            badge.setAttribute('title', accessibleLabel);
            badge.setAttribute('aria-label', accessibleLabel);

            const dayEl = badge.querySelector('.date-day');
            if (dayEl) dayEl.textContent = dayOfWeek;

            const monthLongEl = badge.querySelector('.date-month-long');
            if (monthLongEl) monthLongEl.textContent = monthLong;

            const monthShortEl = badge.querySelector('.date-month-short');
            if (monthShortEl) monthShortEl.textContent = monthShort;

            const dayNumEl = badge.querySelector('.date-day-num');
            if (dayNumEl) dayNumEl.textContent = dayNum;

            const yearEl = badge.querySelector('.date-year');
            if (yearEl) yearEl.textContent = year;
        });
    }

    updateDateDisplays();
    // Periodic check to update automatically if day changes across midnight
    setInterval(updateDateDisplays, 60000);

    // --- INTERACTIVE CALENDAR CONTROLLER ---
    const dateDropdownContainer = document.getElementById("date-dropdown-container");
    const headerDateBtn = document.getElementById("header-date");
    const sidebarDateBtn = document.getElementById("sidebar-date");
    const mobileDateBtn = document.getElementById("mobile-date");
    const weatherContainer = document.querySelector(".weather-dropdown-container");

    let calViewYear = new Date().getFullYear();
    let calViewMonth = new Date().getMonth(); // 0-11
    let calSelectedDate = new Date();

    function renderCalendarGrid(year, month) {
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const monthYearTitle = document.getElementById("cal-month-year");
        if (monthYearTitle) {
            monthYearTitle.textContent = `${monthNames[month]} ${year}`;
        }

        const grid = document.getElementById("cal-days-grid");
        if (!grid) return;
        grid.innerHTML = "";

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        const todayDate = today.getDate();

        const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
        const totalDays = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        // 1. Previous month trailing days
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const dayNum = prevMonthDays - i;
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cal-day-cell cal-day-other";
            cell.textContent = dayNum;
            cell.setAttribute("aria-label", `Previous month, day ${dayNum}`);
            cell.addEventListener("click", (e) => {
                e.stopPropagation();
                calViewMonth--;
                if (calViewMonth < 0) {
                    calViewMonth = 11;
                    calViewYear--;
                }
                renderCalendarGrid(calViewYear, calViewMonth);
            });
            grid.appendChild(cell);
        }

        // 2. Current month days
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cal-day-cell";
            cell.textContent = day;

            const isToday = isCurrentMonth && day === todayDate;
            if (isToday) {
                cell.classList.add("cal-day-today");
                cell.setAttribute("title", "Today");
            }

            const isSelected = calSelectedDate &&
                calSelectedDate.getFullYear() === year &&
                calSelectedDate.getMonth() === month &&
                calSelectedDate.getDate() === day;
            if (isSelected) {
                cell.classList.add("cal-day-selected");
            }

            cell.setAttribute("aria-label", `${monthNames[month]} ${day}, ${year}${isToday ? " (Today)" : ""}`);

            cell.addEventListener("click", (e) => {
                e.stopPropagation();
                calSelectedDate = new Date(year, month, day);
                const dayOfWeek = calSelectedDate.toLocaleDateString("en-US", { weekday: "long" });
                const monthShort = calSelectedDate.toLocaleDateString("en-US", { month: "short" });

                const selectedLabel = document.getElementById("cal-selected-label");
                if (selectedLabel) {
                    selectedLabel.textContent = isToday ? `Today: ${dayOfWeek}, ${monthShort} ${day}` : `${dayOfWeek}, ${monthShort} ${day}`;
                }

                grid.querySelectorAll(".cal-day-selected").forEach(el => el.classList.remove("cal-day-selected"));
                cell.classList.add("cal-day-selected");
            });

            grid.appendChild(cell);
        }

        // 3. Next month leading days (to complete 7-day row)
        const totalRendered = firstDayIndex + totalDays;
        const remainder = (7 - (totalRendered % 7)) % 7;
        for (let day = 1; day <= remainder; day++) {
            const cell = document.createElement("button");
            cell.type = "button";
            cell.className = "cal-day-cell cal-day-other";
            cell.textContent = day;
            cell.setAttribute("aria-label", `Next month, day ${day}`);
            cell.addEventListener("click", (e) => {
                e.stopPropagation();
                calViewMonth++;
                if (calViewMonth > 11) {
                    calViewMonth = 0;
                    calViewYear++;
                }
                renderCalendarGrid(calViewYear, calViewMonth);
            });
            grid.appendChild(cell);
        }
    }

    function toggleCalendarDropdown(open) {
        if (!dateDropdownContainer) return;
        const shouldOpen = open !== undefined ? open : !dateDropdownContainer.classList.contains("open");
        if (shouldOpen) {
            if (weatherContainer) weatherContainer.classList.remove("open");
            dateDropdownContainer.classList.add("open");
            if (headerDateBtn) headerDateBtn.setAttribute("aria-expanded", "true");
            renderCalendarGrid(calViewYear, calViewMonth);
        } else {
            dateDropdownContainer.classList.remove("open");
            if (headerDateBtn) headerDateBtn.setAttribute("aria-expanded", "false");
        }
    }

    if (headerDateBtn) {
        headerDateBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleCalendarDropdown();
        });
    }

    if (sidebarDateBtn) {
        sidebarDateBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleCalendarDropdown(true);
        });
    }

    if (mobileDateBtn) {
        mobileDateBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleCalendarDropdown(true);
        });
    }

    const prevMonthBtn = document.getElementById("cal-prev-btn");
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            calViewMonth--;
            if (calViewMonth < 0) {
                calViewMonth = 11;
                calViewYear--;
            }
            renderCalendarGrid(calViewYear, calViewMonth);
        });
    }

    const nextMonthBtn = document.getElementById("cal-next-btn");
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            calViewMonth++;
            if (calViewMonth > 11) {
                calViewMonth = 0;
                calViewYear++;
            }
            renderCalendarGrid(calViewYear, calViewMonth);
        });
    }

    const todayJumpBtn = document.getElementById("cal-today-btn");
    if (todayJumpBtn) {
        todayJumpBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            const now = new Date();
            calViewYear = now.getFullYear();
            calViewMonth = now.getMonth();
            calSelectedDate = now;
            renderCalendarGrid(calViewYear, calViewMonth);
            const selectedLabel = document.getElementById("cal-selected-label");
            if (selectedLabel) {
                const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
                const monthShort = now.toLocaleDateString("en-US", { month: "short" });
                selectedLabel.textContent = `Today: ${dayOfWeek}, ${monthShort} ${now.getDate()}`;
            }
        });
    }

    // Close calendar on outside click
    document.addEventListener("click", (e) => {
        if (dateDropdownContainer && !dateDropdownContainer.contains(e.target)) {
            toggleCalendarDropdown(false);
        }
    });

    // Close calendar on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && dateDropdownContainer && dateDropdownContainer.classList.contains("open")) {
            toggleCalendarDropdown(false);
        }
    });

    // Initial render
    renderCalendarGrid(calViewYear, calViewMonth);

    let isScrollingFromClick = false;
    let clickTimeout = null;

    function setActiveLink(activeSec) {
        if (!activeSec) return;
        
        navLinks.forEach(l => l.classList.remove('active'));
        mobileLinks.forEach(l => l.classList.remove('active'));
        
        if (activeSec.link) activeSec.link.classList.add('active');
        if (activeSec.mobileLink) activeSec.mobileLink.classList.add('active');
    }

    // Close Mobile Menu Overlay
    function closeMobileMenu() {
        mobileOverlay.classList.remove('open');
        document.body.classList.remove('mobile-menu-open');
        hamburgerIcon.classList.remove('hidden');
        closeIcon.classList.add('hidden');
    }

    // Open Mobile Menu Overlay
    function openMobileMenu() {
        mobileOverlay.classList.add('open');
        document.body.classList.add('mobile-menu-open');
        hamburgerIcon.classList.add('hidden');
        closeIcon.classList.remove('hidden');
    }

    // Toggle Mobile Menu Overlay
    mobileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mobileOverlay.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // 1. Click Listener for instant highlight and scroll-spy bypass
    const allLinks = [...navLinks, ...mobileLinks];
    allLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            if (clickTimeout) clearTimeout(clickTimeout);
            isScrollingFromClick = true;

            // Highlight instantly
            const targetHref = this.getAttribute('href');
            const activeSec = sections.find(s => {
                const href = targetHref === '#' ? '#' : targetHref;
                return href === (targetHref === '#' ? '#' : '#' + s.id);
            });
            
            if (activeSec) {
                setActiveLink(activeSec);
            }
            closeMobileMenu();

            // Allow scroll spy again after smooth scroll finishes
            clickTimeout = setTimeout(() => {
                isScrollingFromClick = false;
            }, 800);
        });
    });

    // Close mobile menu if window is resized above mobile breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && mobileOverlay.classList.contains('open')) {
            closeMobileMenu();
        }
    });

    // 2. Scroll Spy using offsets
    window.addEventListener('scroll', () => {
        if (isScrollingFromClick) return;

        let currentActive = null;
        const scrollPos = window.scrollY + window.innerHeight * 0.45; // trigger line at 45% of viewport

        // Find which section container is currently in focus
        sections.forEach(sec => {
            const el = document.getElementById(sec.id);
            if (el) {
                const top = el.offsetTop;
                const height = el.offsetHeight;
                if (scrollPos >= top && scrollPos < top + height) {
                    currentActive = sec;
                }
            }
        });

        // Force active state to Contact if user scrolled to bottom of the page
        if ((window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 20) {
            currentActive = sections.find(s => s.id === 'contact');
        }

        if (currentActive) {
            setActiveLink(currentActive);
        }
    });

    // Mesh Gradient Orbs mousemove parallax
    const orb1 = document.querySelector('.orb-1');
    const orb2 = document.querySelector('.orb-2');
    if (orb1 && orb2) {
        window.addEventListener('mousemove', (e) => {
            const { clientX, clientY } = e;
            const x1 = (clientX - window.innerWidth / 2) * 0.08;
            const y1 = (clientY - window.innerHeight / 2) * 0.08;
            const x2 = (clientX - window.innerWidth / 2) * -0.05;
            const y2 = (clientY - window.innerHeight / 2) * -0.05;

            orb1.style.transform = `translate(${x1}px, ${y1}px)`;
            orb2.style.transform = `translate(${x2}px, ${y2}px)`;
        });
    }

    // macOS Dock Magnification Effect
    const dockGrid = document.querySelector('.quick-links-grid');
    const dockCards = document.querySelectorAll('.quick-link-card');

    if (dockGrid && dockCards.length > 0) {
        document.body.classList.add('js-enabled');

        const isHoverSupported = window.matchMedia('(hover: hover)').matches;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isHoverSupported && !prefersReducedMotion) {
            const maxScale = 1.4;
            const range = 160; // range of influence in pixels

            dockGrid.addEventListener('mousemove', (e) => {
                const mouseX = e.clientX;
                const mouseY = e.clientY;

                dockCards.forEach(card => {
                    const mark = card.querySelector('.card-mark');
                    if (!mark) return;

                    const rect = card.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    // Calculate 2D distance from cursor to icon center
                    const dist = Math.sqrt(Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2));

                    if (dist < range) {
                        const ratio = dist / range;
                        const factor = Math.cos(ratio * Math.PI / 2); // 1 when close, 0 when far
                        
                        const scale = 1 + (maxScale - 1) * Math.pow(factor, 1.8);
                        const y = -16 * Math.pow(factor, 1.8);
                        mark.style.transform = `translateY(${y}px) scale(${scale})`;
                    } else {
                        mark.style.transform = '';
                    }
                });
            });

            dockGrid.addEventListener('mouseleave', () => {
                dockCards.forEach(card => {
                    const mark = card.querySelector('.card-mark');
                    if (mark) {
                        mark.style.transform = '';
                    }
                });
            });
        }
    }
})();

// --- GREETING TYPEWRITER ---
(function () {
    const greeting = document.getElementById('bio-greeting');
    if (!greeting) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    greeting.classList.add('tw-armed');

    // Wrap every character in a hidden span, keeping the wave markup intact.
    // The name is skipped: the pen writes it out once typing finishes.
    const chars = [];
    const walker = document.createTreeWalker(greeting, NodeFilter.SHOW_TEXT, {
        acceptNode: node => node.parentElement.closest('.bio-name')
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    textNodes.forEach(node => {
        const text = node.textContent.replace(/\s+/g, ' ');
        const frag = document.createDocumentFragment();
        Array.from(text).forEach(ch => {
            const span = document.createElement('span');
            span.className = 'tw-char tw-hidden';
            span.textContent = ch;
            frag.appendChild(span);
            chars.push(span);
        });
        node.replaceWith(frag);
    });

    // Drop the leading space left over from HTML indentation
    while (chars.length && chars[0].textContent === ' ') chars.shift().remove();

    const caret = document.createElement('span');
    caret.className = 'tw-caret';
    caret.setAttribute('aria-hidden', 'true');
    greeting.setAttribute('aria-label', greeting.textContent.trim());

    let i = 0;
    function typeNext() {
        if (i >= chars.length) {
            caret.remove();
            greeting.classList.add('typed');
            return;
        }
        const span = chars[i++];
        span.classList.remove('tw-hidden');
        span.after(caret);
        const delay = span.textContent === ' ' ? 60 : 70 + Math.random() * 70;
        setTimeout(typeNext, delay);
    }

    chars[0].before(caret);
    setTimeout(typeNext, 400);
})();
