export function initMenu() {
  const toggleButton = document.querySelector('[data-menu-toggle]');
  const mobileNav = document.querySelector('[data-mobile-nav]');
  const header = document.querySelector('.site-header');

  if (!toggleButton || !mobileNav) {
    return;
  }

  const setOpen = (isOpen) => {
    const isMobileViewport = window.innerWidth <= 980;
    const shouldOpen = isOpen && isMobileViewport;

    mobileNav.classList.toggle('is-open', shouldOpen);
    mobileNav.hidden = !shouldOpen;
    mobileNav.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    toggleButton.setAttribute('aria-expanded', String(shouldOpen));
    toggleButton.textContent = shouldOpen ? 'Close' : 'Menu';
    document.body.classList.toggle('menu-open', shouldOpen);
  };

  setOpen(false);

  toggleButton.addEventListener('click', () => {
    const next = toggleButton.getAttribute('aria-expanded') !== 'true';
    setOpen(next);
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  document.addEventListener('click', (event) => {
    if (!mobileNav.classList.contains('is-open')) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (header && !header.contains(target) && !mobileNav.contains(target)) {
      setOpen(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 980) {
      setOpen(false);
    }
  });
}
