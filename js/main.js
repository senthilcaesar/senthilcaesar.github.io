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

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
    body.classList.add('dark-mode');
    updateThemeIcon(true);
} else {
    updateThemeIcon(false);
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-mode');
    const isDark = body.classList.contains('dark-mode');
    updateThemeIcon(isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    // Trigger gear theme update if function exists
    if (typeof window.updateGearTheme === 'function') {
        window.updateGearTheme(isDark);
    }
});

// --- NAVIGATION & INTERACTIVE CONTROLLERS ---
(function () {
    const navLinks = document.querySelectorAll('.header-middle .nav-link');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileOverlay = document.getElementById('mobile-nav-overlay');
    const hamburgerIcon = mobileToggle.querySelector('.hamburger-icon');
    const closeIcon = mobileToggle.querySelector('.close-icon');

    const sections = [
        { 
            id: 'about-section', 
            link: document.querySelector('.header-middle a[href="#"]'),
            mobileLink: document.querySelector('.mobile-nav-link[href="#"]')
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
    if (aboutSec) aboutSec.id = 'about-section';

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
})();
