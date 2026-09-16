/* Malo MLV — Coaching sportif
   Comportements communs : navigation, animations, accordéon, formulaire de bilan. */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- Utils */
  var toastEl = document.getElementById("toast");
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 4200);
  }

  /* --------------------------------------------------------------- Header & Navigation */
  var header = document.getElementById("header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-stuck", window.scrollY > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Burger Menu */
  var burger = document.getElementById("burger");
  var mobileNav = document.getElementById("mobileNav");
  if (burger && mobileNav) {
    burger.addEventListener("click", function () {
      var isOpen = mobileNav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      burger.classList.toggle("is-active", isOpen);
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobileNav.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        burger.classList.remove("is-active");
      });
    });
  }

  /* Reveal Animations */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.1 }
    );
    reveals.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  /* FAQ Accordion */
  document.querySelectorAll(".faq__item").forEach(function (item) {
    var btn = item.querySelector(".faq__q");
    var ans = item.querySelector(".faq__a");
    if (!btn || !ans) return;
    btn.addEventListener("click", function () {
      var isOpen = item.classList.contains("is-open");
      // Close other open items in the same FAQ
      var parentFaq = item.closest(".faq");
      if (parentFaq) {
        parentFaq.querySelectorAll(".faq__item.is-open").forEach(function (openItem) {
          if (openItem !== item) {
            openItem.classList.remove("is-open");
            var otherBtn = openItem.querySelector(".faq__q");
            var otherAns = openItem.querySelector(".faq__a");
            if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
            if (otherAns) otherAns.style.maxHeight = "0";
          }
        });
      }

      if (isOpen) {
        item.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        ans.style.maxHeight = "0";
      } else {
        item.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        ans.style.maxHeight = ans.scrollHeight + "px";
      }
    });
  });

  /* Year */
  document.querySelectorAll("[data-year]").forEach(function (span) {
    span.textContent = new Date().getFullYear();
  });

  /* --------------------------------------------------------------- Questionnaire Form */
  var form = document.getElementById("bilanForm");
  if (!form) return;

  var STORAGE_KEY = "malo-bilan-v1";
  var CONTACT_FIELDS = ["prenom", "nom", "email", "tel", "age", "taille", "poids", "sexe"];
  var SCALE_QUESTIONS = ["q20", "q26"];

  /* Champs pris en compte dans la barre d'avancement : prénom, email et les 29 questions. */
  var requiredNames = ["prenom", "email"];
  for (var i = 1; i <= 29; i++) {
    if (SCALE_QUESTIONS.indexOf("q" + i) === -1) requiredNames.push("q" + i);
  }

  function fieldsByName(name) {
    return form.querySelectorAll('[name="' + name + '"]');
  }

  function groupAnswered(name) {
    var fields = fieldsByName(name);
    if (!fields.length) return false;
    var type = fields[0].type;
    if (type === "radio" || type === "checkbox") {
      return Array.prototype.some.call(fields, function (f) {
        return f.checked;
      });
    }
    if (type === "range") return true;
    return fields[0].value.trim() !== "";
  }

  /* ---------- Accessibilité des groupes de réponses ---------- */
  form.querySelectorAll(".q").forEach(function (block, index) {
    var group = block.querySelector(".choices");
    var labelSpan = block.querySelector(".q__label span:not(.q__hint)");
    if (!group || !labelSpan) return;
    if (!labelSpan.id) labelSpan.id = "qlabel-" + index;
    group.setAttribute("role", "group");
    group.setAttribute("aria-labelledby", labelSpan.id);
  });

  /* ---------- État visuel des cases cochées ---------- */
  function paintChoices() {
    form.querySelectorAll(".choice").forEach(function (choice) {
      var input = choice.querySelector("input");
      choice.classList.toggle("is-checked", !!(input && input.checked));
    });
  }

  /* ---------- Barre de progression ---------- */
  var progressFill = document.getElementById("progressFill");
  var progressPct = document.getElementById("progressPct");
  var progressText = document.getElementById("progressText");
  var qNavLinks = Array.prototype.slice.call(document.querySelectorAll("#qNav a"));

  function updateProgress() {
    var done = requiredNames.filter(groupAnswered).length;
    var total = requiredNames.length;
    var pct = Math.round((done / total) * 100);
    if (progressFill) progressFill.style.width = pct + "%";
    if (progressPct) progressPct.textContent = pct + " %";
    if (progressText) {
      progressText.textContent =
        done + (done === 1 ? " réponse" : " réponses") + " sur " + total + " questions";
    }
  }

  /* ---------- Curseurs 1 à 10 ---------- */
  function paintSlider(input) {
    var min = Number(input.min || 1);
    var max = Number(input.max || 10);
    var value = Number(input.value);
    var fill = ((value - min) / (max - min)) * 100;
    input.style.setProperty("--fill", fill + "%");
    var output = form.querySelector('output[for="' + input.id + '"]');
    if (output) output.textContent = String(value);
  }

  form.querySelectorAll('input[type="range"]').forEach(function (input) {
    paintSlider(input);
    input.addEventListener("input", function () {
      paintSlider(input);
    });
  });

  /* ---------- Champs « Autre » et alertes santé ---------- */
  function syncConditionals() {
    form.querySelectorAll("[data-other]").forEach(function (input) {
      var target = form.querySelector(
        '[data-conditional="' + input.getAttribute("data-other") + '"]'
      );
      if (!target) return;
      target.hidden = !input.checked;
      if (input.checked) {
        var text = target.querySelector("input, textarea");
        if (text && !text.value) {
          setTimeout(function () {
            text.focus({ preventScroll: true });
          }, 60);
        }
      }
    });

    var healthAlert = document.getElementById("healthAlert");
    if (healthAlert) {
      var risky = Array.prototype.some.call(
        form.querySelectorAll("[data-health]"),
        function (input) {
          return input.checked;
        }
      );
      healthAlert.hidden = !risky;
    }
  }

  /* « Aucune » est exclusif dans les contraintes alimentaires (q25) */
  function enforceQ25(input) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('input[name="q25"]'));
    var none = fields.filter(function (field) {
      return field.value === "Aucune";
    })[0];
    if (!none) return;

    if (none.checked) {
      fields.forEach(function (field) {
        if (field !== none) field.checked = false;
      });
    } else if (input && input.checked && input !== none) {
      none.checked = false;
    }
  }

  form.querySelectorAll('input[name="q25"]').forEach(function (input) {
    input.addEventListener("change", function () {
      enforceQ25(input);
      paintChoices();
    });
  });

  /* ---------- Sauvegarde locale ---------- */
  function collectState() {
    var state = {};
    form.querySelectorAll("input, textarea, select").forEach(function (el) {
      if (!el.name) return;
      if (el.type === "radio" || el.type === "checkbox") {
        if (el.checked) {
          state[el.name] = state[el.name] || [];
          state[el.name].push(el.value);
        }
      } else {
        state[el.name] = el.value;
      }
    });
    return state;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectState()));
    } catch (err) {
      /* navigation privée : on continue sans sauvegarde */
    }
  }

  function restoreState() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return;
    }
    if (!raw) return;

    var state;
    try {
      state = JSON.parse(raw);
    } catch (err) {
      return;
    }

    Object.keys(state).forEach(function (name) {
      var value = state[name];
      form.querySelectorAll('[name="' + name + '"]').forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") {
          el.checked = Array.isArray(value) ? value.indexOf(el.value) !== -1 : value === el.value;
        } else {
          el.value = value;
        }
      });
    });

    form.querySelectorAll('input[type="range"]').forEach(paintSlider);
  }

  var saveTimer = null;
  form.addEventListener("input", function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveState, 400);
  });

  form.addEventListener("change", function () {
    syncConditionals();
    paintChoices();
    updateProgress();
    saveState();
  });

  /* ---------- Navigation de sections ---------- */
  if ("IntersectionObserver" in window && qNavLinks.length) {
    var sections = Array.prototype.slice.call(form.querySelectorAll(".q-section"));
    var sectionObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var id = entry.target.id;
          if (!id) return;
          qNavLinks.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
          });
        });
      },
      { rootMargin: "-30% 0px -55% 0px" }
    );
    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });
  }

  /* ---------- Construction du résumé à envoyer ---------- */
  function stripEmoji(text) {
    return text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function labelFor(name) {
    var field = form.querySelector('[name="' + name + '"]');
    if (!field) return name;
    var holder = field.closest(".field");
    if (holder && holder.querySelector("label")) {
      return holder.querySelector("label").textContent.replace("*", "").trim();
    }
    return name;
  }

  function groupValueText(name) {
    var fields = fieldsByName(name);
    if (!fields.length) return "";
    var type = fields[0].type;
    if (type === "radio" || type === "checkbox") {
      return Array.prototype.filter
        .call(fields, function (f) {
          return f.checked;
        })
        .map(function (f) {
          return f.value;
        })
        .join(", ");
    }
    return fields[0].value.trim();
  }

  function blockValueText(block) {
    var parts = [];
    block.querySelectorAll("input, textarea, select").forEach(function (el) {
      if (el.type === "radio" || el.type === "checkbox") {
        if (el.checked) parts.push(el.value);
      } else if (el.type === "range") {
        parts.push(el.value + "/10");
      } else if (el.value.trim()) {
        parts.push(el.value.trim());
      }
    });
    return parts.join(" | ");
  }

  function buildMessage() {
    var lines = [];
    var contact = [];

    CONTACT_FIELDS.forEach(function (name) {
      var value = groupValueText(name);
      if (value) contact.push(labelFor(name) + " : " + value);
    });

    lines.push("BILAN INITIAL — COACHING MALO MLV");
    lines.push("");
    lines.push("--- COORDONNÉES ---");
    lines.push(contact.length ? contact.join("\n") : "Non renseignées");

    form.querySelectorAll(".q-section[data-section]").forEach(function (section) {
      var blocks = section.querySelectorAll(".q");
      if (!blocks.length) return;

      var heading = section.querySelector("h2");
      var num = section.querySelector(".q-section__head span");
      lines.push("");
      lines.push(
        "--- " +
          (num ? num.textContent.trim() + ". " : "") +
          stripEmoji(heading ? heading.textContent.trim() : "") +
          " ---"
      );

      blocks.forEach(function (block) {
        var numEl = block.querySelector(".q__label b");
        var questionEl = block.querySelector(".q__label span:not(.q__hint)");
        lines.push("");
        lines.push(
          (numEl ? numEl.textContent.trim() + ". " : "") +
            (questionEl ? questionEl.textContent.trim() : "")
        );
        lines.push("> " + (blockValueText(block) || "(pas de réponse)"));
      });
    });

    lines.push("");
    lines.push("---");
    lines.push("Envoyé depuis le questionnaire du site.");
    return lines.join("\n");
  }

  function clearErrors() {
    form.querySelectorAll('[name="prenom"], [name="email"]').forEach(function (field) {
      field.style.borderColor = "";
    });
  }

  function validate() {
    clearErrors();
    var missing = null;
    ["prenom", "email"].forEach(function (name) {
      var field = form.querySelector('[name="' + name + '"]');
      if (!field) return;
      if (!field.value.trim()) {
        field.style.borderColor = "var(--red)";
        if (!missing) missing = field;
      }
    });

    var email = form.querySelector('[name="email"]');
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
      email.style.borderColor = "var(--red)";
      toast("L'adresse email ne semble pas valide.");
      return false;
    }

    if (missing) {
      missing.focus();
      missing.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(
        "Il manque ton " +
          (missing.name === "prenom" ? "prénom" : "email") +
          " pour que je puisse te répondre."
      );
      return false;
    }
    return true;
  }

  function downloadPdf(text, firstName) {
    var lines = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E\n]/g, "").split("\n");
    var wrapped = [];
    lines.forEach(function (line) {
      var value = line || " ";
      while (value.length > 88) {
        wrapped.push(value.slice(0, 88));
        value = value.slice(88);
      }
      wrapped.push(value);
    });
    var pages = [];
    for (var start = 0; start < wrapped.length; start += 52) pages.push(wrapped.slice(start, start + 52));
    function escapePdf(value) {
      return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    }
    var objects = [null];
    function addObject(value) {
      objects.push(value);
      return objects.length - 1;
    }
    var fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    var pageIds = [];
    pages.forEach(function (pageLines) {
      var content = ["BT", "/F1 9 Tf", "42 800 Td", "12 TL"];
      pageLines.forEach(function (line, index) {
        if (index) content.push("T*");
        content.push("(" + escapePdf(line) + ") Tj");
      });
      content.push("ET");
      var contentId = addObject("<< /Length " + content.join("\n").length + " >>\nstream\n" + content.join("\n") + "\nendstream");
      pageIds.push(addObject("<< /Type /Page /Parent PAGES /MediaBox [0 0 595 842] /Resources << /Font << /F1 " + fontId + " 0 R >> >> /Contents " + contentId + " 0 R >>"));
    });
    var pagesId = addObject("<< /Type /Pages /Kids [" + pageIds.map(function (id) { return id + " 0 R"; }).join(" ") + "] /Count " + pageIds.length + " >>");
    var catalogId = addObject("<< /Type /Catalog /Pages " + pagesId + " 0 R >>");
    objects = objects.map(function (object) { return object && object.replace("PAGES", pagesId + " 0 R"); });
    var pdf = "%PDF-1.4\n";
    var offsets = [0];
    objects.slice(1).forEach(function (object, index) {
      offsets.push(pdf.length);
      pdf += index + 1 + " 0 obj\n" + object + "\nendobj\n";
    });
    var xref = pdf.length;
    pdf += "xref\n0 " + objects.length + "\n0000000000 65535 f \n";
    offsets.slice(1).forEach(function (offset) { pdf += String(offset).padStart(10, "0") + " 00000 n \n"; });
    pdf += "trailer\n<< /Size " + objects.length + " /Root " + catalogId + " 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    var link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    link.download = "bilan-malo-mlv-" + (firstName || "coaching").toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function showContactChoices(prenom, nom) {
    var success = document.getElementById("qSuccess");
    var subject = encodeURIComponent("Bilan coaching — " + (prenom + " " + nom).trim());
    var message = encodeURIComponent("Bonjour Malo, je t'envoie mon bilan PDF. Merci !");
    var email = document.getElementById("emailContact");
    var sms = document.getElementById("messageContact");
    if (email) email.href = "mailto:malomlv.coaching@gmail.com?subject=" + subject + "&body=" + message;
    if (sms) sms.href = "sms:+33642427036?&body=" + message;
    if (success) {
      success.hidden = false;
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  /* Validation, téléchargement du bilan et choix du canal de contact. */
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!validate()) return;

    var prenom = form.querySelector('[name="prenom"]').value.trim();
    var nomField = form.querySelector('[name="nom"]');
    var nom = nomField ? nomField.value.trim() : "";
    var body = buildMessage();
    var endpoint = form.getAttribute("data-endpoint");

    saveState();

    if (endpoint) {
      var sendBtn = document.getElementById("submitBtn");
      if (sendBtn) sendBtn.disabled = true;

      var payload = { sujet: (prenom + " " + nom).trim(), bilan: body };
      var state = collectState();
      Object.keys(state).forEach(function (key) {
        payload[key] = state[key];
      });

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          if (!response.ok) throw new Error("Envoi refusé");
          downloadPdf(body, prenom);
          showContactChoices(prenom, nom);
          toast("PDF téléchargé. Choisis maintenant comment contacter Malo.");
        })
        .catch(function () {
          toast("L'envoi a échoué. Utilise « Copier mes réponses » et envoie-les par email.");
        })
        .then(function () {
          if (sendBtn) sendBtn.disabled = false;
        });
      return;
    }

    downloadPdf(body, prenom);
    showContactChoices(prenom, nom);
    toast("PDF téléchargé. Choisis maintenant comment contacter Malo.");
  });

  var copyBtn = document.getElementById("copyBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var text = buildMessage();

      function fallback() {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
          toast("Réponses copiées. Colle-les dans un email à malomlv.coaching@gmail.com.");
        } catch (err) {
          toast("La copie automatique a échoué. Sélectionne le texte manuellement.");
        }
        document.body.removeChild(area);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          toast("Réponses copiées. Colle-les dans un email à malomlv.coaching@gmail.com.");
        }, fallback);
      } else {
        fallback();
      }
    });
  }

  var resetBtn = document.getElementById("resetForm");
  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      form.reset();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* ignoré */
      }
      form.querySelectorAll('input[type="range"]').forEach(paintSlider);
      clearErrors();
      paintChoices();
      syncConditionals();
      updateProgress();
      toast("Formulaire vidé.");
    });
  }

  /* ---------- Démarrage ---------- */
  restoreState();
  enforceQ25();
  paintChoices();
  syncConditionals();
  updateProgress();
})();
