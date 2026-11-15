/* =========================================================
   Jonathan Valdes — CV site · interactions
   No dependencies. Progressive enhancement only.
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;
  const THEME_KEY = "jv-theme";

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0a1020" : "#0b2545");
  }

  function initTheme() {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (q === "light" || q === "dark") {
      applyTheme(q);
    } else {
      let stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch (e) {}
      if (stored === "light" || stored === "dark") {
        applyTheme(stored);
      } else {
        applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      }
    }

    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  function initHeader() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    // ?still disables entrance animations (used for screenshots / QA / print previews).
    if (new URLSearchParams(window.location.search).has("still")) return;

    const targets = document.querySelectorAll(
      ".section-head, .profile-text, .mini-card, .comp-card, .job, .cred-block, .contact-inner > *"
    );
    if (!("IntersectionObserver" in window)) return;

    targets.forEach((el, i) => {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(i % 4, 3) * 55 + "ms";
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    targets.forEach((el) => io.observe(el));
  }

  /* ---------- Print / PDF ---------- */
  function initPrint() {
    const btn = document.getElementById("printBtn");
    if (btn) btn.addEventListener("click", () => window.print());
  }

  /* ---------- Phone reveal (privacy: numbers are not in plain HTML) ---------- */
  function initPhoneReveal() {
    document.querySelectorAll(".phone-reveal").forEach((btn) => {
      btn.addEventListener("click", () => {
        let data;
        try {
          data = JSON.parse(atob(btn.dataset.phone || ""));
        } catch (e) {
          return;
        }
        if (!data || !data.tel) return;
        const a = document.createElement("a");
        a.href = "tel:" + data.tel;
        a.className = "phone-link";
        a.textContent = (btn.dataset.region ? btn.dataset.region + " · " : "") + data.display;
        btn.replaceWith(a);
        a.focus();
      });
    });
  }

  /* ---------- Year ---------- */
  function initYear() {
    const y = document.getElementById("year");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- Boot ---------- */
  initTheme();
  initHeader();
  initPrint();
  initPhoneReveal();
  initYear();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }
})();
