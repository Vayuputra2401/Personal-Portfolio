/* ============================================================
   MAIN.JS — Portfolio JavaScript
   ============================================================ */

'use strict';

// ── 1. Navbar: scroll effect ────────────────────────────────
const navbar = document.getElementById('navbar');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
  updateActiveNav();
});

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

// ── 7. Smooth scroll for in-page anchors ────────────────────
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

function openModal() {
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
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
