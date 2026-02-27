(() => {
  const navToggle = document.querySelector("[data-nav-toggle]");
  const nav = document.getElementById("mainNav");

  if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // Placeholder UX: kliknięcia w przyciski panelu pokazują, że to szkic.
  const demoButtons = document.querySelectorAll("[data-demo-action]");
  demoButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const body = document.body;
      body.dataset.toast = "To jest szkielet panelu. Ten moduł podłączymy do danych z CRM w kolejnych krokach.";
      body.classList.add("demo-toast");
      window.clearTimeout(window.__keikaToastTimer);
      window.__keikaToastTimer = window.setTimeout(() => {
        body.classList.remove("demo-toast");
        delete body.dataset.toast;
      }, 2200);
    });
  });
})();
