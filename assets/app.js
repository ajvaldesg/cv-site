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

  /* ---------- Live API badge + visit counter ---------- */
  function setBadge(state, text) {
    document.querySelectorAll(".live-badge").forEach((badge) => {
      badge.setAttribute("data-state", state);
      const copy = badge.querySelector(".live-copy, #liveText");
      if (copy) copy.textContent = text;
    });
  }

  function setVisits(text) {
    document.querySelectorAll(".visits-copy, #visitsText").forEach((el) => {
      el.textContent = text;
    });
  }

  function initLiveStatus() {
    if (!document.querySelector(".live-badge")) return;

    const started = performance.now();
    fetch("/api/health", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data) => {
        const ms = Math.round(performance.now() - started);
        const region = data && data.region ? " · " + data.region : "";
        setBadge("ok", "API · " + ms + " ms" + region);
      })
      .catch(() => setBadge("down", "API · unreachable"));

    fetch("/api/visits", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
      .then((data) => {
        if (data && typeof data.count === "number") {
          setVisits("visits · " + data.count.toLocaleString("en-US"));
        } else {
          setVisits("visits · n/a");
        }
      })
      .catch(() => setVisits("visits · n/a"));
  }

  /* ---------- Contact form ---------- */
  function initContactForm() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const note = document.getElementById("formNote");
    const btn = form.querySelector("button[type=submit]");

    const say = (msg, state) => {
      if (!note) return;
      note.textContent = msg;
      note.setAttribute("data-state", state || "");
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = form.elements;
      const data = {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        message: fields.message.value.trim(),
      };

      if (data.name.length < 2) return say("Please add your name.", "error");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) return say("That email does not look right.", "error");
      if (data.message.length < 10) return say("Tell me a bit more (10+ characters).", "error");

      const original = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      say("Sending…", "");

      try {
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          const map = {
            name_required: "Please add your name.",
            email_invalid: "That email does not look right.",
            message_too_short: "Tell me a bit more (10+ characters).",
            storage_not_configured: "The inbox is being configured — email me directly meanwhile.",
          };
          throw new Error(map[body.error] || "Something went wrong. Try email instead.");
        }
        form.reset();
        say("Message received — I will get back to you. Thank you!", "ok");
      } catch (err) {
        say(err && err.message ? err.message : "Something went wrong. Try email instead.", "error");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      }
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
  initLiveStatus();
  initContactForm();
  initYear();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }
})();
