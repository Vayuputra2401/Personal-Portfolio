/* ============================================================
   MAIN.JS — Portfolio JavaScript
   ============================================================ */

'use strict';

// ── 1. Navbar: scroll effect + scroll progress ──────────────
const navbar = document.getElementById('navbar');
const scrollProgressBar = document.getElementById('scroll-progress');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  updateActiveNav();
  // Update page scroll progress
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const pct = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
  scrollProgressBar.style.width = pct + '%';
}, { passive: true });

// ── 2. Active nav link (IntersectionObserver) ───────────────
const sections  = Array.from(document.querySelectorAll('section[id]'));
const navLinks  = Array.from(document.querySelectorAll('.nav-link'));

function updateActiveNav() {
  const scrollMid = window.scrollY + window.innerHeight / 2;

  sections.forEach(section => {
    const top    = section.offsetTop;
    const bottom = top + section.offsetHeight;

    if (scrollMid >= top && scrollMid < bottom) {
      navLinks.forEach(link => {
        link.classList.toggle(
          'active',
          link.getAttribute('href') === `#${section.id}`
        );
      });
    }
  });
}

// Run once on load
updateActiveNav();

// ── 3. Mobile menu ──────────────────────────────────────────
const menuBtn  = document.getElementById('nav-menu-btn');
const closeBtn = document.getElementById('nav-close-btn');
const navMenu  = document.getElementById('nav-links');

function openMenu()  { navMenu.classList.add('open'); }
function closeMenu() { navMenu.classList.remove('open'); }

if (menuBtn)  menuBtn.addEventListener('click', openMenu);
if (closeBtn) closeBtn.addEventListener('click', closeMenu);

// Close when a nav link is clicked
navLinks.forEach(link => link.addEventListener('click', closeMenu));

// Close on outside click
document.addEventListener('click', e => {
  if (
    navMenu.classList.contains('open') &&
    !navMenu.contains(e.target) &&
    e.target !== menuBtn
  ) {
    closeMenu();
  }
});

// ── 4. Typed.js ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const typedEl = document.querySelector('.typed-text');
  if (typedEl && typeof Typed !== 'undefined') {
    new Typed('.typed-text', {
      strings: [
        'ML Engineer.',
        'Data Engineer.',
        'Research Engineer.',
        'Full Stack Developer.',
      ],
      typeSpeed:  75,
      backSpeed:  45,
      backDelay:  2000,
      startDelay: 400,
      loop:       true,
      showCursor: true,
      cursorChar: '|',
    });
  }
});

// ── 5a. Stat counter animation ───────────────────────────────
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const suffix = el.dataset.suffix || '';
  const duration = 1400;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.8 });

document.querySelectorAll('.stat-number[data-target]').forEach(el => {
  counterObserver.observe(el);
});

// ── 5. Scroll reveal (IntersectionObserver) ─────────────────
const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Don't unobserve — keeps .visible stable on re-scroll
      }
    });
  },
  { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
);

document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => {
  revealObserver.observe(el);
});

// ── 6. Project filter tabs ──────────────────────────────────
const filterBtns   = document.querySelectorAll('.filter-btn');
const projectCards = document.querySelectorAll('.project-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Update active state
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter;

    projectCards.forEach(card => {
      const cats = (card.dataset.category || '').split(' ');
      const show  = filter === 'all' || cats.includes(filter);

      if (show) {
        card.classList.remove('hidden');
        card.style.animation = 'fadeInUp 0.4s ease forwards';
      } else {
        card.classList.add('hidden');
        card.style.animation = '';
      }
    });
  });
});

// ── 7. Sticky scroll sections ───────────────────────────────

// Generic factory used by Experience, Research, and Skills
function initStickySection(wrapper, panelScrollH) {
  const panels   = wrapper.querySelectorAll('.exp-panel, .ssw-panel');
  const navItems = wrapper.querySelectorAll('.exp-nav-item, .ssw-nav-item');
  const counter  = wrapper.querySelector('.ssw-counter-current');
  const bar      = wrapper.querySelector('.ssw-progress-bar');
  if (!panels.length) return;

  const total = panels.length;
  let   prev  = -1;

  function setActive(idx) {
    if (idx === prev) return;

    if (prev >= 0 && panels[prev]) {
      const old = panels[prev];
      old.classList.remove('active');
      old.classList.add('leaving');
      setTimeout(() => old.classList.remove('leaving'), 520);
    }

    // Remove any stale .leaving before making active (handles fast reverse-scroll)
    panels[idx].classList.remove('leaving');
    panels[idx].classList.add('active');
    navItems.forEach((n, i) => n.classList.toggle('active', i === idx));

    if (counter) counter.textContent = String(idx + 1).padStart(2, '0');
    if (bar)     bar.style.width = `${((idx + 1) / total) * 100}%`;

    prev = idx;
  }

  function onScroll() {
    const top = wrapper.getBoundingClientRect().top;
    if (top > 0) { setActive(0); return; }
    const idx = Math.min(total - 1, Math.floor(-top / panelScrollH));
    setActive(idx);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Click nav to jump
  navItems.forEach((item, i) => {
    item.addEventListener('click', () => {
      const wrapperTop = wrapper.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: wrapperTop + i * panelScrollH, behavior: 'smooth' });
    });
  });
}

// Experience: 1 full viewport per panel  (wrapper = 4 × 100vh + 100vh = 500vh)
const expWrapper = document.querySelector('.exp-sticky-wrapper');
if (expWrapper) initStickySection(expWrapper, window.innerHeight);

// Research: 70vh per panel  (wrapper = 8 × 70vh + 100vh = 660vh)
const rschWrapper = document.querySelector('#research .ssw-wrapper');
if (rschWrapper) initStickySection(rschWrapper, window.innerHeight * 0.7);

// Skills: 80vh per panel  (wrapper = 4 × 80vh + 100vh = 420vh)
const sklWrapper = document.querySelector('#skills .ssw-wrapper');
if (sklWrapper) initStickySection(sklWrapper, window.innerHeight * 0.8);

// Projects: 80vh per panel  (wrapper = 6 × 80vh + 100vh = 580vh)
const projWrapper = document.querySelector('#projects .ssw-wrapper');
if (projWrapper) initStickySection(projWrapper, window.innerHeight * 0.8);

// Leadership: 80vh per panel  (wrapper = 3 × 80vh + 100vh = 340vh)
const leadWrapper = document.querySelector('#leadership .ssw-wrapper');
if (leadWrapper) initStickySection(leadWrapper, window.innerHeight * 0.8);

// Building: 80vh per panel  (wrapper = 2 × 80vh + 100vh = 260vh)
const buildWrapper = document.querySelector('#building .ssw-wrapper');
if (buildWrapper) initStickySection(buildWrapper, window.innerHeight * 0.8);

// Patent: 1 panel, 100vh per panel  (wrapper = 1 × 100vh + 100vh = 200vh)
const patentWrapper = document.querySelector('#patent .ssw-wrapper');
if (patentWrapper) initStickySection(patentWrapper, window.innerHeight);

// Achievements: 2 panels, 80vh per panel  (wrapper = 2 × 80vh + 100vh = 260vh)
const achievWrapper = document.querySelector('#achievements .ssw-wrapper');
if (achievWrapper) initStickySection(achievWrapper, window.innerHeight * 0.8);

// ── 8a. Section anchor copy-to-clipboard ────────────────────
document.querySelectorAll('.section-anchor').forEach(btn => {
  btn.addEventListener('click', () => {
    const hash = btn.dataset.href;
    const url = `${location.origin}${location.pathname}${hash}`;
    navigator.clipboard?.writeText(url).then(() => {
      btn.innerHTML = '<i class="bx bx-check"></i>';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = '<i class="bx bx-link"></i>';
        btn.classList.remove('copied');
      }, 1600);
    });
  });
});

// ── 8. Smooth scroll for in-page anchors ─────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = navbar ? navbar.offsetHeight : 68;
      const top    = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// ── 8. Contact modal ─────────────────────────────────────────
const modalOverlay  = document.getElementById('contact-modal');
const modalOpenBtns = document.querySelectorAll('[data-modal="contact"]');
const modalCloseBtn = document.getElementById('modal-close');
const formBody      = document.getElementById('form-body');
const formSuccess   = document.getElementById('form-success');
const contactForm   = document.getElementById('contact-form');

const FOCUSABLE = 'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])';
let _trapFn = null;
let _lastFocus = null;

function openModal() {
  _lastFocus = document.activeElement;
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  const els = Array.from(modalOverlay.querySelectorAll(FOCUSABLE));
  const first = els[0];
  const last  = els[els.length - 1];
  setTimeout(() => first?.focus(), 60);

  _trapFn = e => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  };
  modalOverlay.addEventListener('keydown', _trapFn);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_trapFn) { modalOverlay.removeEventListener('keydown', _trapFn); _trapFn = null; }
  _lastFocus?.focus();
}

modalOpenBtns.forEach(btn => btn.addEventListener('click', e => {
  e.preventDefault();
  openModal();
}));

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

// Click outside modal box to close
modalOverlay?.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// ESC key closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalOverlay?.classList.contains('open')) closeModal();
});

// ── 9. Contact form — EmailJS ────────────────────────────────
//
//  One-time setup (free, 200 emails/month):
//  1. Sign up at https://emailjs.com
//  2. Add a Gmail service → copy your SERVICE_ID below
//  3. Create an email template with these variables:
//       {{from_name}}  {{from_email}}  {{subject}}  {{message}}
//     Copy your TEMPLATE_ID below
//  4. Account → API Keys → copy your PUBLIC_KEY below
//
const EMAILJS_PUBLIC_KEY  = '7BZGP-ZYoJd0QYkxL';
const EMAILJS_SERVICE_ID  = 'service_1q0rd5c';
const EMAILJS_TEMPLATE_ID = 'template_0qjnf3l';

if (typeof emailjs !== 'undefined') {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

if (contactForm) {
  contactForm.addEventListener('submit', async e => {
    e.preventDefault();

    const submitBtn = contactForm.querySelector('.form-submit');
    const origHTML  = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Sending…';
    submitBtn.disabled  = true;

    const templateParams = {
      from_name:  contactForm.querySelector('[name="name"]').value.trim(),
      from_email: contactForm.querySelector('[name="email"]').value.trim(),
      subject:    contactForm.querySelector('[name="subject"]').value.trim() || 'Portfolio Contact',
      message:    contactForm.querySelector('[name="message"]').value.trim(),
    };

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      formBody.style.display = 'none';
      formSuccess.classList.add('show');
    } catch (err) {
      console.error('EmailJS error:', err);
      submitBtn.innerHTML = origHTML;
      submitBtn.disabled  = false;
      alert('Something went wrong. Please email me directly at pathikreetofficial@gmail.com');
    }
  });
}
