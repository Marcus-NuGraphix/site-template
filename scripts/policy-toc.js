export function initPolicyToc() {
  const tocLinks = Array.from(document.querySelectorAll('.policy-nav-list a[href^="#"]'));
  if (tocLinks.length === 0) {
    return;
  }

  const sections = tocLinks
    .map((link) => {
      const hash = link.getAttribute('href') || '';
      const id = hash.startsWith('#') ? hash.slice(1) : '';
      if (!id) {
        return null;
      }

      const section = document.getElementById(id);
      if (!section) {
        return null;
      }

      return { link, section };
    })
    .filter(Boolean);

  if (sections.length === 0) {
    return;
  }

  const setCurrent = (activeId) => {
    sections.forEach((entry) => {
      const isActive = entry.section.id === activeId;
      if (isActive) {
        entry.link.setAttribute('aria-current', 'true');
      } else {
        entry.link.removeAttribute('aria-current');
      }
    });
  };

  if (!('IntersectionObserver' in window)) {
    setCurrent(sections[0].section.id);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        const nextId = visible[0].target.id;
        setCurrent(nextId);
      }
    },
    {
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0, 1],
    }
  );

  sections.forEach((entry) => observer.observe(entry.section));
  setCurrent(sections[0].section.id);
}
