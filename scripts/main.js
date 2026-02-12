import { initMenu } from './menu.js';
import { initReveal } from './reveal.js';
import { initYear } from './year.js';
import { initDeleteRequestForm } from './forms/delete-request-form.js';

document.documentElement.classList.add('has-js');

function initHeaderState() {
  const header = document.querySelector('.site-header');
  if (!header) {
    return;
  }

  const sync = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8);
  };

  sync();
  window.addEventListener('scroll', sync, { passive: true });
}

function initSite() {
  initHeaderState();
  initMenu();
  initReveal();
  initYear();
  initDeleteRequestForm();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSite, { once: true });
} else {
  initSite();
}
