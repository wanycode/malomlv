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

  /* --------------------------------------------------------------- Espace client */
  var CLIENT_CODE = "clientmalo";
  var CLIENT_ACCESS_KEY = "malo-client-access";
  var TRACKER_KEY = "malo-client-tracking-v1";
  var CLIENT_BILAN_KEY = "malo-client-bilan-v1";
  var DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

  function normText(value) {
    return String(value == null ? "" : value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function firstNumber(value) {
    var match = String(value == null ? "" : value).replace(",", ".").match(/-?\d+(?:\.\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
  }

  function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function splitAnswer(value) {
    return String(value == null ? "" : value)
      .split("|")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  function includesText(value, needle) {
    return normText(value).indexOf(normText(needle)) !== -1;
  }

  function localStore(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (err) {
      return null;
    }
    return value;
  }

  function localRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      /* navigation privée */
    }
  }

  /* ---------- Lecture des réponses collées ---------- */
  function parseBilan(text) {
    var result = { q: {}, contact: {}, answers: 0 };
    var lines = String(text == null ? "" : text).replace(/\r/g, "").split("\n");
    var pending = null;

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();
      if (!line) return;

      var question = line.match(/^Q(\d{1,2})\s*[.)]\s*(.+)$/i);
      if (question) {
        var key = String(parseInt(question[1], 10));
        if (!result.q[key]) result.q[key] = { question: question[2].trim(), answer: "" };
        pending = key;
        return;
      }

      if (pending && line.charAt(0) === ">") {
        var answer = line.replace(/^>\s*/, "").trim();
        if (answer && answer !== "(pas de réponse)" && !result.q[pending].answer) {
          result.q[pending].answer = answer;
          result.answers++;
        }
        pending = null;
        return;
      }

      if (line.charAt(0) === ">") return;
      if (line.indexOf("---") === 0) {
        pending = null;
        return;
      }

      var contact = line.match(/^([^:]{2,48})\s*:\s*(.+)$/);
      if (!contact) return;
      pending = null;
      var label = normText(contact[1]);
      var value = contact[2].trim();
      if (label.indexOf("prenom") !== -1) result.contact.prenom = value;
      else if (label === "nom") result.contact.nom = value;
      else if (label.indexOf("email") !== -1) result.contact.email = value;
      else if (label.indexOf("telephone") !== -1) result.contact.tel = value;
      else if (label === "age") result.contact.age = value;
      else if (label.indexOf("taille") !== -1) result.contact.taille = value;
      else if (label.indexOf("poids") !== -1) result.contact.poids = value;
      else if (label.indexOf("sexe") !== -1) result.contact.sexe = value;
    });

    return result;
  }

  /* ---------- Référentiels ---------- */
  var OBJECTIFS = {
    muscle: {
      label: "Prise de muscle",
      adj: 1.12,
      prot: 1.8,
      direction: "léger surplus calorique, priorité aux protéines et à la progression des charges",
    },
    seche: {
      label: "Perte de poids / sèche",
      adj: 0.82,
      prot: 2.2,
      direction: "déficit calorique progressif, protéines hautes, volume d'entraînement maintenu",
    },
    recomp: {
      label: "Recomposition corporelle",
      adj: 0.92,
      prot: 2.0,
      direction: "léger déficit avec charges lourdes, pour perdre du gras en gardant le muscle",
    },
    force: {
      label: "Prise de force",
      adj: 1.06,
      prot: 1.8,
      direction: "maintien des calories, séries lourdes et récupération respectée",
    },
    condition: {
      label: "Condition physique",
      adj: 1.0,
      prot: 1.6,
      direction: "calories de maintien, travail de capacité et de régularité",
    },
    autre: {
      label: "Objectif personnalisé",
      adj: 1.0,
      prot: 1.8,
      direction: "base de maintien, ajustée ensuite selon ton evolution",
    },
  };

  var NIVEAUX = {
    debutant: { label: "Débutant", volume: "10 à 14 séries par groupe musculaire et par semaine" },
    intermediaire: { label: "Intermédiaire", volume: "12 à 18 séries par groupe musculaire et par semaine" },
    avance: { label: "Avancé", volume: "15 à 22 séries par groupe musculaire et par semaine" },
  };

  var STRUCTURES = {
    court: "5 exercices maximum, 2 supersets, repos de 60 à 75 s",
    moyen: "6 exercices, 1 à 2 supersets, repos de 90 s",
    long: "6 à 7 exercices, repos de 90 à 120 s",
    tresLong: "7 à 8 exercices, isolations 60 s et mouvements lourds 120 à 180 s",
  };

  var SPLITS = {
    2: [
      ["Full body A", "Haut et bas du corps, mouvements polyarticulaires"],
      ["Full body B", "Variantes, unilatéral et gainage"],
    ],
    3: [
      ["Full body A", "Poussée, tirage, jambes"],
      ["Full body B", "Variantes, unilatéral, gainage"],
      ["Full body C", "Rappel force, épaules et bras"],
    ],
    4: [
      ["Haut du corps A", "Poussée lourde puis tirage"],
      ["Bas du corps A", "Squat et chaîne postérieure"],
      ["Haut du corps B", "Tirage lourd, épaules, bras"],
      ["Bas du corps B", "Soulevé de terre, unilatéral, mollets"],
    ],
    5: [
      ["Push", "Pectoraux, épaules, triceps"],
      ["Pull", "Dos, biceps"],
      ["Jambes", "Quadriceps, ischios, fessiers, mollets"],
      ["Haut du corps", "Rappel volume et points faibles"],
      ["Bas du corps", "Rappel volume, gainage"],
    ],
    6: [
      ["Push", "Pectoraux, épaules, triceps"],
      ["Pull", "Dos, biceps"],
      ["Jambes", "Quadriceps, ischios, fessiers"],
      ["Push volume", "Pectoraux, épaules, triceps"],
      ["Pull volume", "Dos, biceps"],
      ["Jambes volume", "Bas du corps, mollets, gainage"],
    ],
  };

  var PPL = [
    ["Push", "Pectoraux, épaules, triceps"],
    ["Pull", "Dos, biceps"],
    ["Jambes", "Quadriceps, ischios, fessiers, mollets"],
  ];

  /* Chaque limite cochée renvoie à un livrable de l'offre. */
  var LIMIT_ACTIONS = [
    {
      match: "manque de temps",
      titre: "Des séances calibrées sur ton temps réel",
      texte: function (report) {
        return (
          "Ton plan s'écrit sur " +
          report.cibleBadge +
          (report.dureeText ? " de " + report.dureeText : "") +
          ". Aucune séance ne déborde du créneau que tu as annoncé : un plan qui ne tient pas ne tient pas trois semaines."
        );
      },
    },
    {
      match: "difficulte a etre regulier",
      titre: "Un plan d'action hebdomadaire",
      texte: function () {
        return "Chaque semaine a son plan écrit et son relevé : tu coches tes séances dans le tableau de bord, et on relit les chiffres au lieu de compter sur la motivation.";
      },
    },
    {
      match: "je ne sais pas construire",
      titre: "Des séances écrites, exercice par exercice",
      texte: function () {
        return "Tu reçois l'ordre des exercices, les séries, les répétitions et le repos. Plus rien à décider sur le moment, et une option de remplacement pour chaque mouvement selon ton matériel.";
      },
    },
    {
      match: "je ne sais pas comment progresser",
      titre: "Une méthode de progression explicite",
      texte: function (report) {
        return report.progression;
      },
    },
    {
      match: "mon alimentation",
      titre: "Une nutrition chiffrée",
      texte: function (report) {
        return report.nutrition
          ? "Départ à " + report.nutrition.kcal + " kcal et " + report.nutrition.proteines + " g de protéines par jour, ajustés ensuite selon la variation de ton poids."
          : "Renseigne taille, poids et âge dans ton bilan pour que je cale tes calories et tes macronutriments au gramme près.";
      },
    },
    {
      match: "je recupere mal",
      titre: "Récupération traitée comme un pilier",
      texte: function () {
        return "Sommeil et hydratation passent dans le protocole, et le volume est calé sur ta récupération réelle plutôt que sur un modèle théorique.";
      },
    },
    {
      match: "manque de motivation",
      titre: "Un cadre qui te responsabilise",
      texte: function () {
        return "Tu as un interlocuteur qui relit tes chiffres et corrige le tir. C'est ce qui distingue un suivi d'un PDF oublié dans un dossier.";
      },
    },
    {
      match: "douleurs",
      titre: "Les mouvements à problème retirés",
      texte: function () {
        return "Les exercices concernés sont retirés ou remplacés. Une douleur qui persiste demande d'abord un avis médical : je ne diagnostique pas et je ne traite pas une blessure.";
      },
    },
  ];

  function activityBase(value) {
    var text = normText(value);
    if (text.indexOf("tres sedentaire") !== -1) return 1.2;
    if (text.indexOf("peu active") !== -1) return 1.3;
    if (text.indexOf("tres active") !== -1) return 1.7;
    if (text.indexOf("active") !== -1) return 1.45;
    return 1.4;
  }

  function sleepHours(value) {
    var text = normText(value);
    if (!text) return NaN;
    var short = text.match(/moins de\s*(\d+)/);
    if (short) return clampNumber(parseInt(short[1], 10) - 1, 3, 12);
    var range = text.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    var plus = text.match(/(\d+)\s*h/);
    if (plus) return parseFloat(plus[1]);
    return NaN;
  }

  function durationKey(value) {
    if (includesText(value, "moins de 45")) return "court";
    if (includesText(value, "45-60")) return "moyen";
    if (includesText(value, "60-75")) return "long";
    if (includesText(value, "75 min")) return "tresLong";
    return "moyen";
  }

  function buildSplit(count, niveau) {
    if (count <= 2) return SPLITS[2];
    if (count === 3) return niveau === "debutant" ? SPLITS[3] : PPL;
    if (count === 4) return SPLITS[4];
    if (count === 5) return SPLITS[5];
    return SPLITS[6];
  }

  /* ---------- Analyse ---------- */
  function analyzeBilan(parsed) {
    function q(number) {
      var entry = parsed.q[String(number)];
      return entry ? entry.answer : "";
    }

    var contact = parsed.contact;
    var objectif = "autre";
    if (includesText(q(1), "prise de muscle")) objectif = "muscle";
    else if (includesText(q(1), "seche") || includesText(q(1), "perte de poids")) objectif = "seche";
    else if (includesText(q(1), "recomposition")) objectif = "recomp";
    else if (includesText(q(1), "force")) objectif = "force";
    else if (includesText(q(1), "condition")) objectif = "condition";

    var niveauTexte = normText(q(4));
    var niveau = "intermediaire";
    if (niveauTexte.indexOf("3 ans et") !== -1) niveau = "avance";
    else if (niveauTexte.indexOf("1 a 3 ans") !== -1 || niveauTexte.indexOf("6 mois a 1 an") !== -1) niveau = "intermediaire";
    else if (niveauTexte.indexOf("moins de 6 mois") !== -1 || niveauTexte.indexOf("debute") !== -1) niveau = "debutant";

    var seancesActuelles = firstNumber(q(5));
    var seancesCapacite = firstNumber(q(8));
    var seancesVariable = includesText(q(8), "variable");
    var seancesEstimees = isNaN(seancesCapacite) && isNaN(seancesActuelles);
    var cible = !isNaN(seancesCapacite) ? seancesCapacite : !isNaN(seancesActuelles) ? seancesActuelles : 3;
    cible = clampNumber(Math.round(cible), 2, 6);
    var cibleBadge = seancesVariable ? "3 séances fixes minimum" : cible + " séances par semaine";
    var cibleShort = seancesEstimees ? cibleBadge + " (repère de départ, pas ta réponse)" : cibleBadge;

    var dureeText = q(9);
    var dureeCle = durationKey(dureeText);

    var joursText = q(10);
    var jours = DAY_NAMES.filter(function (day) {
      return includesText(joursText, day);
    });

    var limites = splitAnswer(q(13));
    var heures = sleepHours(q(19));
    var recuperation = firstNumber(q(20));
    var stress = normText(q(21));
    var regularite = firstNumber(q(26));
    var attentes = splitAnswer(q(27));
    var sante = includesText(q(16), "oui") || includesText(q(17), "oui") || includesText(q(18), "oui");

    var organisation = 25;
    if (!isNaN(seancesCapacite)) organisation += 25;
    if (jours.length) organisation += 20;
    if (q(11)) organisation += 15;
    if (q(12) && q(12).length > 3) organisation += 15;
    organisation = clampNumber(organisation, 15, 100);

    var scoreRecup = 30;
    if (!isNaN(heures)) scoreRecup += clampNumber((heures - 5) / 3, 0, 1) * 35;
    if (!isNaN(recuperation)) scoreRecup += (clampNumber(recuperation, 0, 10) / 10) * 30;
    else scoreRecup += 15;
    if (stress.indexOf("tres eleve") !== -1) scoreRecup -= 15;
    else if (stress.indexOf("eleve") !== -1) scoreRecup -= 5;
    else if (stress.indexOf("faible") !== -1) scoreRecup += 5;
    scoreRecup = clampNumber(Math.round(scoreRecup), 10, 100);

    var q6 = normText(q(6));
    var marge = niveau === "debutant" ? 88 : niveau === "intermediaire" ? 72 : 55;
    if (q6.indexOf("jamais") !== -1) marge += 8;
    else if (q6.indexOf("pas regulierement") !== -1) marge += 4;
    else if (q6.indexOf("regulierement") !== -1) marge -= 8;
    if (!isNaN(seancesActuelles) && !isNaN(seancesCapacite) && seancesCapacite > seancesActuelles) marge += 5;
    marge = clampNumber(marge, 20, 98);

    var alimentation = isNaN(regularite) ? null : clampNumber(Math.round(regularite * 10), 10, 100);

    var poids = firstNumber(contact.poids);
    var taille = firstNumber(contact.taille);
    var age = firstNumber(contact.age);
    var sexe = normText(contact.sexe);
    var nutrition = null;
    if (!isNaN(poids) && !isNaN(taille) && !isNaN(age) && poids > 0 && taille > 0 && age > 0) {
      var offset = sexe.indexOf("homme") !== -1 ? 5 : sexe.indexOf("femme") !== -1 ? -161 : -78;
      var base = activityBase(q(22)) + Math.min(0.15, Math.max(0, (cible - 2) * 0.04));
      var tdee = (10 * poids + 6.25 * taille - 5 * age + offset) * base;
      var kcal = Math.round((tdee * OBJECTIFS[objectif].adj) / 10) * 10;
      var proteines = Math.round(poids * OBJECTIFS[objectif].prot);
      var lipides = Math.round((kcal * 0.28) / 9);
      var glucides = Math.max(0, Math.round((kcal - proteines * 4 - lipides * 9) / 4));
      nutrition = {
        poids: poids,
        tdee: Math.round(tdee / 10) * 10,
        kcal: kcal,
        proteines: proteines,
        lipides: lipides,
        glucides: glucides,
        base: base,
        sexeInconnu: sexe.indexOf("homme") === -1 && sexe.indexOf("femme") === -1,
      };
    }

    var report = {
      prenom: contact.prenom || "",
      objectif: objectif,
      objectifLabel: OBJECTIFS[objectif].label,
      objectifDirection: OBJECTIFS[objectif].direction,
      niveauLabel: NIVEAUX[niveau].label,
      volume: NIVEAUX[niveau].volume,
      progression:
        niveau === "debutant"
          ? "Progression linéaire : dès que tu passes le haut de la fourchette de répétitions sur toutes tes séries, tu montes la charge. Un exercice bloqué deux séances de suite, on change la variante."
          : niveau === "avance"
          ? "Périodisation par blocs de 4 à 6 semaines, avec une semaine de décharge toutes les 6 à 8 semaines pour encaisser le volume."
          : "Double progression : d'abord les répétitions dans la fourchette, puis la charge. Décharge prévue toutes les 6 à 8 semaines.",
      cibleShort: cibleShort,
      cibleBadge: cibleBadge,
      seancesEstimees: seancesEstimees,
      dureeText: dureeText,
      structure: STRUCTURES[dureeCle],
      split: buildSplit(cible, niveau),
      jours: jours,
      lieu: q(11),
      materiel: q(12),
      limites: limites,
      heures: heures,
      recuperation: recuperation,
      stress: q(21),
      activite: q(22),
      regularite: regularite,
      attentes: attentes,
      sante: sante,
      scores: {
        organisation: organisation,
        recuperation: scoreRecup,
        marge: marge,
        alimentation: alimentation,
      },
      nutrition: nutrition,
      priorites: [],
      vigilances: [],
      questions: parsed.answers,
      date: new Date(),
    };

    report.priorites = buildPriorites(report);
    report.vigilances = buildVigilances(report);
    return report;
  }

  function buildPriorites(report) {
    var priorites = [];
    /* 1. Les limites cochées sont reliées aux livrables de l'offre. */
    var couverts = [];
    report.limites.forEach(function (limite, index) {
      if (priorites.length >= 3) return;
      var avant = priorites.length;
      LIMIT_ACTIONS.forEach(function (rule) {
        if (priorites.length >= 3) return;
        if (!includesText(limite, rule.match)) return;
        var duplicata = priorites.some(function (item) {
          return item.titre === rule.titre;
        });
        if (duplicata) return;
        priorites.push({ titre: rule.titre, texte: rule.texte(report), source: "Q13" });
      });
      if (priorites.length > avant) couverts.push(index);
    });

    /* 2. Les limites sans règle dédiée (dont le champ « Autre ») deviennent un point de travail. */
    report.limites.forEach(function (limite, index) {
      if (priorites.length >= 3) return;
      if (couverts.indexOf(index) !== -1) return;
      if (normText(limite) === "autre" || limite.length < 4) return;
      priorites.push({
        titre: "Point de travail : " + limite,
        texte:
          "Tu l'as identifié comme un frein. On l'attaque dès la première version du programme et on le relit au premier ajustement.",
        source: "Q13",
      });
    });

    if (priorites.length < 3 && report.nutrition && report.scores.alimentation !== null && report.scores.alimentation < 70) {
      priorites.push({
        titre: "Régulariser les repas avant de tout changer",
        texte:
          "Ta régularité alimentaire est notée " +
          report.regularite +
          "/10. On garde tes aliments, on fixe juste les repères : " +
          report.nutrition.kcal +
          " kcal et " +
          report.nutrition.proteines +
          " g de protéines par jour.",
        source: "Q24 · Q26",
      });
    }

    if (priorites.length < 3 && (isNaN(report.heures) || report.heures <= 6.5 || (report.recuperation && report.recuperation <= 6))) {
      priorites.push({
        titre: "Sécuriser la récupération",
        texte:
          "Sans sommeil ni récupération, le même programme rapporte moitié moins. Le protocole sommeil et hydratation de ton offre passe avant les séries supplémentaires.",
        source: "Q19 · Q20",
      });
    }

    if (priorites.length < 3) {
      priorites.push({
        titre: "Tenir la progression sur la durée",
        texte:
          "Ton profil est " +
          report.niveauLabel.toLowerCase() +
          " avec " +
          report.cibleShort +
          ". On écrit les charges, on note les répétitions, et on fait évoluer les paramètres quand les chiffres stagnent.",
        source: "Q4 · Q8",
      });
    }

    return priorites.slice(0, 3);
  }

  function buildVigilances(report) {
    var vigilances = [];
    if (report.sante) {
      vigilances.push(
        "Tu as signalé une douleur, une blessure passée ou une restriction médicale. Un avis médical est nécessaire avant de programmer les exercices concernés : le questionnaire ne sert pas à poser un diagnostic ni à traiter une blessure."
      );
    }
    if (!isNaN(report.heures) && report.heures <= 6) {
      vigilances.push(
        "Sommeil court : environ " + report.heures + " h par nuit. Avec moins de 6 h, la récupération limite les charges avant la volonté."
      );
    }
    if (!isNaN(report.recuperation) && report.recuperation <= 5) {
      vigilances.push(
        "Récupération notée " + report.recuperation + "/10. Le volume de départ sera calé dessous, avec de la marge sur les dernières séries."
      );
    }
    if (report.stress && (includesText(report.stress, "eleve"))) {
      vigilances.push("Stress élevé au quotidien : les semaines chargées seront prévues avec une séance allégée plutôt qu'une séance sautée.");
    }
    if (report.objectif === "seche" && !isNaN(report.heures) && report.heures < 7) {
      vigilances.push("Sèche et sommeil inférieur à 7 h : le déficit restera modéré pour ne pas perdre du muscle au passage.");
    }
    if (report.limites.some(function (limite) { return includesText(limite, "douleur"); }) && !report.sante) {
      vigilances.push("Tu as coché les douleurs parmi tes limites sans cocher la partie santé : dis-moi précisément où et dans quels mouvements.");
    }
    return vigilances;
  }

  /* ---------- Rendu du rapport ---------- */
  function meter(label, value, basis) {
    var vide = value === null || value === undefined;
    var barre = vide
      ? '<div class="meter__bar is-empty"></div>'
      : '<div class="meter__bar"><i style="--w:' + value + '%"></i></div>';
    return (
      '<div class="meter"><div class="meter__head"><span>' + escapeHtml(label) + '</span><b>' + (vide ? "—" : value) + '</b></div>' +
      barre +
      '<span class="meter__basis">' + escapeHtml(basis) + '</span></div>'
    );
  }

  function renderReport(report, isSample) {
    var out = document.getElementById("analyseOut");
    if (!out) return;

    var titre = report.prenom ? "Bilan de " + escapeHtml(report.prenom) : "Lecture de ton bilan";
    if (isSample) titre = "Exemple — " + (report.prenom ? "bilan de " + escapeHtml(report.prenom) : "lecture de bilan");

    var jours = report.jours;
    var sessions = report.split.map(function (session, index) {
      var jour = jours[index] || "Séance " + (index + 1);
      return (
        '<div class="session"><span class="session__day">' + escapeHtml(jour) + '</span><div><b>' + escapeHtml(session[0]) + '</b><span>' + escapeHtml(session[1]) + '</span></div></div>'
      );
    }).join("");

    var sessionsNote = report.jours.length
      ? "Calé sur les jours que tu as indiqués (Q10)."
      : "Indique tes jours dans le bilan pour que je cale les séances dessus.";

    var faits = [
      {
        icon: "i-clock",
        label: "Durée par séance",
        value: report.dureeText
          ? report.dureeText + " — " + report.structure
          : "non renseignée dans ton bilan (Q9)",
      },
      { icon: "i-chart", label: "Volume de départ", value: report.volume },
      { icon: "i-bolt", label: "Progression", value: report.progression },
      {
        icon: "i-dumbbell",
        label: "Lieu et matériel",
        value: [report.lieu, report.materiel].filter(Boolean).join(" — ") || "à préciser dans le bilan",
      },
      report.attentes.length
        ? { icon: "i-target", label: "Ce que tu attends", value: report.attentes.join(", ").toLowerCase() }
        : null,
    ].filter(Boolean);

    var facts = faits
      .map(function (fait) {
        return (
          '<div><svg><use href="#' +
          fait.icon +
          '"/></svg><span><b>' +
          escapeHtml(fait.label) +
          " :</b> " +
          escapeHtml(fait.value) +
          "</span></div>"
        );
      })
      .join("");

    var nutritionBlock;
    if (report.nutrition) {
      var n = report.nutrition;
      nutritionBlock =
        '<div class="macros">' +
        '<div class="macro"><span>Dépense estimée</span><b>' + n.tdee + ' kcal</b><small>activité ' + escapeHtml(String(report.activite || "non renseignée")) + '</small></div>' +
        '<div class="macro"><span>Calories cibles</span><b>' + n.kcal + ' kcal</b><small>' + escapeHtml(report.objectifDirection) + '</small></div>' +
        '<div class="macro"><span>Protéines</span><b>' + n.proteines + ' g</b><small>' + Math.round((n.proteines / n.poids) * 10) / 10 + ' g/kg de poids</small></div>' +
        '<div class="macro"><span>Lipides / Glucides</span><b>' + n.lipides + ' g</b><small>' + n.glucides + ' g de glucides</small></div>' +
        '</div>' +
        '<p style="margin-top:1rem">Estimations calculées à partir de ton poids, ta taille, ton âge, ton activité et ' + escapeHtml(report.cibleShort) +
        (n.sexeInconnu ? " (sexe non renseigné : moyenne utilisée)" : "") +
        ', pour un objectif de ' +
        escapeHtml(report.objectifLabel.toLowerCase()) +
        ', sur la base de ' +
        '. Malo ajuste ensuite toutes les deux semaines selon la variation de ton poids.</p>';
    } else {
      nutritionBlock =
        '<p>Il manque au moins un chiffre pour calculer tes besoins. Renseigne ton poids, ta taille et ton âge dans le questionnaire (section coordonnées), relance la copie de tes réponses et relance l\'analyse : tu verras tes calories et tes macronutriments de départ.</p>';
    }

    var priorites = report.priorites.map(function (item) {
      return (
        '<li><div><strong>' + escapeHtml(item.titre) + '</strong><span>' + escapeHtml(item.texte) + '</span></div></li>'
      );
    }).join("");

    var vigilances = report.vigilances.length
      ? '<section class="report__block report__block--alert"><h4>Points de vigilance</h4><ul class="vigil">' +
        report.vigilances.map(function (item) {
          return '<li><svg><use href="#i-alert"/></svg><span>' + escapeHtml(item) + '</span></li>';
        }).join("") +
        '</ul></section>'
      : "";

    var objectifBadge = report.cibleBadge;

    out.innerHTML =
      '<article class="report">' +
      '<div class="report__head"><div>' +
      '<span class="eyebrow">Lecture automatique</span>' +
      '<h3 class="h-card">' + titre + '</h3>' +
      '<p class="report__meta">' + escapeHtml(report.objectifLabel) + " · niveau " + escapeHtml(report.niveauLabel) + " · " + escapeHtml(objectifBadge) + '</p>' +
      '<div class="report__badges">' +
      '<span class="badge badge--red">' + escapeHtml(report.objectifLabel) + '</span>' +
      '<span class="badge">Niveau ' + escapeHtml(report.niveauLabel.toLowerCase()) + '</span>' +
      (report.dureeText ? '<span class="badge">' + escapeHtml(report.dureeText) + ' par séance</span>' : "") +
      (report.lieu ? '<span class="badge">' + escapeHtml(report.lieu) + '</span>' : "") +
      '<span class="badge">' + report.questions + ' réponses lues</span>' +
      (isSample ? '<span class="badge badge--red">Exemple de démonstration</span>' : "") +
      '</div></div>' +
      '<button class="btn btn--ghost btn--sm" type="button" id="reportCopy"><svg><use href="#i-copy"/></svg> Copier l\'analyse</button>' +
      '</div>' +
      '<p class="report__note">' +
      (isSample ? "Réponses d'exemple : remplace-les par les tiennes avant de te fier aux chiffres. " : "") +
      "Analyse automatique de tes réponses, dans ton navigateur. Ce n'est pas le programme final : Malo l'écrit à partir de ton bilan. Les chiffres servent de point de départ, pas de vérité absolue.</p>" +
      '<div class="report__meters">' +
      meter("Organisation", report.scores.organisation, "Q8 · Q9 · Q10 · Q11 · Q12") +
      meter("Récupération", report.scores.recuperation, "Q19 · Q20 · Q21") +
      meter("Marge de progression", report.scores.marge, "Q4 · Q5 · Q6") +
      meter(
        "Régularité alimentaire",
        report.scores.alimentation,
        report.scores.alimentation === null ? "Q26 non renseignée" : "Q24 · Q26"
      ) +
      '</div>' +
      '<section class="report__block"><h4>Ton plan de la semaine</h4>' +
      '<div class="sessions">' + sessions + '</div>' +
      '<p style="margin-top:1rem">' + escapeHtml(sessionsNote) + '</p>' +
      '<div class="report__facts">' + facts + '</div>' +
      '</section>' +
      '<section class="report__block"><h4>Tes repères nutrition</h4>' + nutritionBlock + '</section>' +
      '<section class="report__block"><h4>Tes priorités</h4><ol class="prio">' + priorites + '</ol></section>' +
      vigilances +
      '<div class="report__foot"><span>Les programmes et cette analyse ne remplacent pas un avis médical.</span><span>Analyse générée le ' + report.date.toLocaleDateString("fr-FR") + '</span></div>' +
      '</article>';

    out.hidden = false;

    var copyBtn = document.getElementById("reportCopy");
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var text = reportToText(report, isSample);

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
            toast("Analyse copiée. Colle-la dans un email à Malo.");
          } catch (err) {
            toast("La copie automatique a échoué.");
          }
          document.body.removeChild(area);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            toast("Analyse copiée. Colle-la dans un email à Malo.");
          }, fallback);
        } else {
          fallback();
        }
      });
    }
  }

  function reportToText(report, isSample) {
    var lines = [];
    lines.push("ANALYSE DE BILAN — COACHING MALO MLV");
    if (isSample) lines.push("(exemple de démonstration — ne pas utiliser comme données réelles)");
    lines.push("");
    lines.push("Objectif : " + report.objectifLabel);
    lines.push("Niveau : " + report.niveauLabel);
    lines.push(
      "Séances visées : " +
        report.cibleBadge +
        (report.dureeText ? " (" + report.dureeText + ")" : "") +
        (report.seancesEstimees ? " — repère de départ, pas ta réponse" : "")
    );
    if (!report.dureeText) lines.push("Durée de séance : non renseignée dans le bilan.");
    lines.push("");
    lines.push("--- INDICATEURS ---");
    lines.push("Organisation : " + report.scores.organisation + "/100");
    lines.push("Récupération : " + report.scores.recuperation + "/100");
    lines.push("Marge de progression : " + report.scores.marge + "/100");
    lines.push(
      "Régularité alimentaire : " +
        (report.scores.alimentation === null ? "non renseignée" : report.scores.alimentation + "/100")
    );
    lines.push("");
    lines.push("--- PLAN DE LA SEMAINE ---");
    report.split.forEach(function (session, index) {
      lines.push((report.jours[index] || "Séance " + (index + 1)) + " : " + session[0] + " (" + session[1] + ")");
    });
    if (report.dureeText) lines.push("Structure : " + report.structure);
    lines.push("Volume : " + report.volume);
    lines.push("Progression : " + report.progression);
    lines.push("");
    lines.push("--- NUTRITION ---");
    if (report.nutrition) {
      lines.push("Dépense estimée : " + report.nutrition.tdee + " kcal");
      lines.push("Calories cibles : " + report.nutrition.kcal + " kcal");
      lines.push("Protéines : " + report.nutrition.proteines + " g / Lipides : " + report.nutrition.lipides + " g / Glucides : " + report.nutrition.glucides + " g");
    } else {
      lines.push("Poids, taille ou âge manquants dans le bilan : estimation impossible.");
    }
    lines.push("");
    lines.push("--- PRIORITÉS ---");
    report.priorites.forEach(function (item, index) {
      lines.push(index + 1 + ". " + item.titre + " — " + item.texte);
    });
    if (report.vigilances.length) {
      lines.push("");
      lines.push("--- POINTS DE VIGILANCE ---");
      report.vigilances.forEach(function (item) {
        lines.push("- " + item);
      });
    }
    lines.push("");
    lines.push("Analyse générée le " + report.date.toLocaleDateString("fr-FR") + " depuis l'espace client.");
    return lines.join("\n");
  }

  function paintAnalyseOut(html) {
    var out = document.getElementById("analyseOut");
    if (!out) return;
    out.innerHTML = html;
    out.hidden = false;
  }

  function renderAnalyseError(message) {
    paintAnalyseOut(
      '<div class="report__error"><svg><use href="#i-alert"/></svg><span>' +
        escapeHtml(message) +
        "</span></div>"
    );
  }

  function renderAnalysePlaceholder() {
    paintAnalyseOut(
      '<div class="analyse__placeholder"><svg><use href="#i-bolt"/></svg><strong>En attente de tes réponses</strong><span>Colle le texte copié depuis le questionnaire, puis lance l\'analyse.</span></div>'
    );
  }

  var SAMPLE_BILAN = [
    "BILAN INITIAL — COACHING MALO MLV",
    "EXEMPLE : remplace ces réponses par les tiennes.",
    "",
    "--- COORDONNÉES ---",
    "Âge : 27",
    "Taille (cm) : 178",
    "Poids actuel (kg) : 82",
    "Sexe (pour le calcul des besoins) : Homme",
    "",
    "--- 01. Ton objectif ---",
    "",
    "Q1. Quel est ton objectif principal ?",
    "> Prise de muscle",
    "",
    "Q2. Quel résultat aimerais-tu obtenir grâce au coaching ?",
    "> Prendre 5 kg de muscle et arrêter de stagner sur mes charges.",
    "",
    "Q3. As-tu une échéance ou un objectif précis ?",
    "> Non",
    "",
    "--- 02. Ton niveau en musculation ---",
    "",
    "Q4. Depuis combien de temps pratiques-tu la musculation ?",
    "> 1 à 3 ans",
    "",
    "Q5. Combien de séances fais-tu actuellement par semaine ?",
    "> 3",
    "",
    "Q6. As-tu déjà suivi un programme structuré ?",
    "> Oui, mais pas régulièrement",
    "",
    "Q7. Quels exercices maîtrises-tu particulièrement bien ? Et lesquels te posent problème ?",
    "> À l'aise sur le développé couché et les tractions. Le squat me pose problème.",
    "",
    "--- 03. Ton organisation ---",
    "",
    "Q8. Combien de séances peux-tu réellement consacrer à la musculation chaque semaine ?",
    "> 4",
    "",
    "Q9. Combien de temps peux-tu consacrer à une séance ?",
    "> 60-75 min",
    "",
    "Q10. Quels jours peux-tu généralement t'entraîner ?",
    "> Lundi, mardi, jeudi et samedi matin.",
    "",
    "Q11. Où t'entraînes-tu ?",
    "> Les deux",
    "",
    "Q12. Quel matériel as-tu à disposition ?",
    "> Salle complète, plus haltères et banc chez moi.",
    "",
    "--- 04. Tes contraintes et problématiques ---",
    "",
    "Q13. Qu'est-ce qui te limite actuellement dans ta progression ?",
    "> Difficulté à être régulier | Je ne sais pas comment progresser | Mon alimentation",
    "",
    "Q14. Qu'est-ce qui t'a empêché de progresser jusqu'à maintenant ?",
    "> Je change de programme toutes les trois semaines et je m'arrête pendant les vacances.",
    "",
    "Q15. Y a-t-il des exercices que tu ne veux pas ou ne peux pas faire ? Pourquoi ?",
    "> Pas de soulevé de terre, je perds le dos.",
    "",
    "--- 05. Santé et blessures ---",
    "",
    "Q16. As-tu actuellement une douleur ou une blessure qui pourrait être affectée par l'entraînement ?",
    "> Non",
    "",
    "Q17. As-tu eu des blessures importantes par le passé ?",
    "> Non",
    "",
    "Q18. As-tu une restriction médicale connue concernant l'activité physique ?",
    "> Non",
    "",
    "--- 06. Récupération ---",
    "",
    "Q19. Combien d'heures dors-tu en moyenne par nuit ?",
    "> 6-7 h",
    "",
    "Q20. Comment évalues-tu ta récupération actuellement ?",
    "> 6/10",
    "",
    "Q21. Ton niveau de stress quotidien est généralement :",
    "> Modéré",
    "",
    "Q22. Ton activité quotidienne est plutôt :",
    "> Peu active",
    "",
    "--- 07. Alimentation ---",
    "",
    "Q23. Comment décrirais-tu actuellement ton alimentation ?",
    "> Trois repas par jour, sandwich le midi, je grignote le soir.",
    "",
    "Q24. As-tu actuellement une stratégie alimentaire particulière ?",
    "> Non",
    "",
    "Q25. Y a-t-il des contraintes alimentaires à prendre en compte ?",
    "> Aucune",
    "",
    "Q26. Comment évalues-tu ta régularité alimentaire ?",
    "> 4/10",
    "",
    "--- 08. Pour personnaliser ton coaching ---",
    "",
    "Q27. Qu'attends-tu principalement de moi en tant que coach ?",
    "> Un programme précis | Être guidé sur ma progression",
    "",
    "Q28. Qu'est-ce qui te ferait dire à la fin du coaching : « Ça valait vraiment le coup » ?",
    "> Voir mes charges monter et tenir quatre séances par semaine pendant six mois.",
    "",
    "Q29. Y a-t-il quelque chose d'important que je devrais savoir pour adapter au mieux ton programme ?",
    "> Déplacements fréquents, hôtel deux semaines par mois.",
    "",
    "---",
    "Envoyé depuis le questionnaire du site.",
  ].join("\n");

  /* ---------- Portail client ---------- */
  var gateSection = document.getElementById("clientGate");
  if (gateSection) {
    var clientPanel = document.getElementById("clientPanel");
    var gateForm = document.getElementById("clientGateForm");
    var codeInput = document.getElementById("clientCode");
    var gateError = document.getElementById("gateError");

    function openClientPanel() {
      gateSection.hidden = true;
      if (!clientPanel) return;
      clientPanel.hidden = false;
      if (!clientPanel.classList.contains("is-live")) clientPanel.classList.add("is-live");

      var bilanField = document.getElementById("bilanInput");
      var keptBilan = localStore(CLIENT_BILAN_KEY);
      if (bilanField && keptBilan && !bilanField.value) bilanField.value = keptBilan;
      if (bilanField && bilanField.value.trim()) runAnalyse();
      else renderAnalysePlaceholder();
      renderTracker();

      if (window.location.hash) {
        var target = document.querySelector(window.location.hash);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    function closeClientPanel() {
      if (clientPanel) clientPanel.hidden = true;
      gateSection.hidden = false;
      localRemove(CLIENT_ACCESS_KEY);
      clearGateError();
      if (codeInput) codeInput.value = "";
      gateSection.scrollIntoView({ behavior: "smooth", block: "start" });
      toast("Accès client verrouillé.");
    }

    function clearGateError() {
      if (codeInput) codeInput.removeAttribute("aria-invalid");
      if (gateError) gateError.hidden = true;
    }

    if (codeInput) codeInput.addEventListener("input", clearGateError);

    if (gateForm && codeInput) {
      var gateCode = (gateSection.getAttribute("data-code") || CLIENT_CODE).trim().toLowerCase();

      gateForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var code = codeInput.value.trim().toLowerCase();
        if (code === gateCode) {
          localStore(CLIENT_ACCESS_KEY, "1");
          clearGateError();
          openClientPanel();
          toast("Accès client ouvert. Bon travail.");
        } else {
          codeInput.setAttribute("aria-invalid", "true");
          if (gateError) gateError.hidden = false;
          gateSection.classList.remove("is-denied");
          void gateSection.offsetWidth;
          gateSection.classList.add("is-denied");
          codeInput.select();
        }
      });
    }

    var lockBtn = document.getElementById("clientLock");
    if (lockBtn) lockBtn.addEventListener("click", closeClientPanel);

    /* ---------- Analyse ---------- */
    var analyseBtn = document.getElementById("analyseBtn");
    var analyseInput = document.getElementById("bilanInput");
    var analyseDemo = document.getElementById("analyseDemo");
    var analyseClear = document.getElementById("analyseClear");

    function runAnalyse() {
      var champ = analyseInput || document.getElementById("bilanInput");
      if (!champ) return;
      var text = champ.value.trim();
      if (!text) {
        renderAnalyseError("Colle d'abord tes réponses. Ouvre le questionnaire, clique sur « Copier mes réponses », puis reviens ici.");
        return;
      }
      var parsed = parseBilan(text);
      if (parsed.answers < 6) {
        renderAnalyseError(
          "Je n'ai lu que " +
            parsed.answers +
            " réponse" +
            (parsed.answers === 1 ? "" : "s") +
            " dans ce texte. Utilise le bouton « Copier mes réponses » du questionnaire pour obtenir le bon format, puis colle-le ici en entier."
        );
        return;
      }
      renderReport(analyzeBilan(parsed), text === SAMPLE_BILAN);
    }

    if (analyseInput) {
      var analyseSaveTimer = null;
      analyseInput.addEventListener("input", function () {
        clearTimeout(analyseSaveTimer);
        analyseSaveTimer = setTimeout(function () {
          localStore(CLIENT_BILAN_KEY, analyseInput.value);
        }, 400);
      });
    }

    if (analyseBtn) analyseBtn.addEventListener("click", runAnalyse);

    if (analyseDemo && analyseInput) {
      analyseDemo.addEventListener("click", function () {
        analyseInput.value = SAMPLE_BILAN;
        analyseInput.focus();
        toast("Exemple chargé. Remplace-le par tes vraies réponses.");
      });
    }

    if (analyseClear && analyseInput) {
      analyseClear.addEventListener("click", function () {
        analyseInput.value = "";
        localRemove(CLIENT_BILAN_KEY);
        renderAnalysePlaceholder();
        analyseInput.focus();
      });
    }

    /* ---------- Tableau de bord ---------- */
    var trackerForm = document.getElementById("trackerForm");
    var trackDate = document.getElementById("trackDate");
    if (trackDate && !trackDate.value) trackDate.value = new Date().toISOString().slice(0, 10);

    function fieldValue(id) {
      var field = document.getElementById(id);
      return field ? field.value : "";
    }

    function readTracker() {
      var raw = localStore(TRACKER_KEY);
      if (!raw) return [];
      try {
        var list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
      } catch (err) {
        return [];
      }
    }

    function writeTracker(list) {
      localStore(TRACKER_KEY, JSON.stringify(list));
    }

    function formatDate(value) {
      var date = new Date(value + "T00:00:00");
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    }

    function renderTracker() {
      var listEl = document.getElementById("trackerList");
      var statsEl = document.getElementById("trackerStats");
      var chartEl = document.getElementById("trackerChart");
      if (!listEl || !statsEl || !chartEl) return;

      var entries = readTracker().sort(function (a, b) {
        if (a.date === b.date) return 0;
        return a.date < b.date ? -1 : 1;
      });

      if (!entries.length) {
        statsEl.innerHTML = "";
        chartEl.innerHTML = '<p class="tracker-chart__empty">Aucune donnée pour l\'instant. Ajoute ta première entrée : poids, tour de taille et pas.</p>';
        listEl.innerHTML = '<li class="tracker-empty">Ton suivi apparaîtra ici, du plus récent au plus ancien.</li>';
        return;
      }

      var weights = entries.filter(function (entry) {
        return typeof entry.poids === "number";
      });
      var tailles = entries.filter(function (entry) {
        return typeof entry.taille === "number";
      });
      var pas = entries.filter(function (entry) {
        return typeof entry.pas === "number";
      });

      var tiles = [];
      if (weights.length) {
        var first = weights[0].poids;
        var last = weights[weights.length - 1].poids;
        var delta = Math.round((last - first) * 10) / 10;
        tiles.push('<div class="stat-tile"><span>Poids actuel</span><b>' + last + ' kg</b><small>le ' + escapeHtml(formatDate(weights[weights.length - 1].date)) + '</small></div>');
        if (weights.length > 1) {
          tiles.push(
            '<div class="stat-tile"><span>Variation</span><b>' +
              (delta > 0 ? "+" : "") +
              delta +
              ' kg</b><small class="' +
              (delta < 0 ? "is-down" : delta > 0 ? "is-up" : "") +
              '">depuis le ' +
              escapeHtml(formatDate(weights[0].date)) +
              '</small></div>'
          );
        }
      }
      if (tailles.length) {
        var lastTaille = tailles[tailles.length - 1];
        tiles.push('<div class="stat-tile"><span>Tour de taille</span><b>' + lastTaille.taille + ' cm</b><small>le ' + escapeHtml(formatDate(lastTaille.date)) + '</small></div>');
      }
      if (pas.length) {
        var somme = pas.reduce(function (total, entry) {
          return total + entry.pas;
        }, 0);
        tiles.push(
          '<div class="stat-tile"><span>Pas en moyenne</span><b>' +
            Math.round(somme / pas.length).toLocaleString("fr-FR") +
            '</b><small>sur ' +
            pas.length +
            " relevé" +
            (pas.length > 1 ? "s" : "") +
            '</small></div>'
        );
      }
      statsEl.innerHTML = tiles.join("");

      chartEl.innerHTML = weights.length > 1 ? buildChart(weights) : '<p class="tracker-chart__empty">Ajoute une deuxième pesée pour voir la courbe de progression.</p>';

      listEl.innerHTML = entries
        .slice()
        .reverse()
        .map(function (entry) {
          return (
            '<li class="tracker-item"><b>' +
            escapeHtml(formatDate(entry.date)) +
            '</b>' +
            '<span><em>Poids</em>' +
            (typeof entry.poids === "number" ? entry.poids + " kg" : "—") +
            '</span>' +
            '<span><em>Taille</em>' +
            (typeof entry.taille === "number" ? entry.taille + " cm" : "—") +
            '</span>' +
            '<span><em>Pas</em>' +
            (typeof entry.pas === "number" ? entry.pas.toLocaleString("fr-FR") : "—") +
            '</span>' +
            '<button type="button" data-remove="' +
            escapeHtml(entry.date) +
            '" aria-label="Supprimer l\'entrée du ' +
            escapeHtml(formatDate(entry.date)) +
            '"><svg><use href="#i-trash"/></svg></button></li>'
          );
        })
        .join("");

      listEl.querySelectorAll("[data-remove]").forEach(function (button) {
        button.addEventListener("click", function () {
          var date = button.getAttribute("data-remove");
          writeTracker(
            readTracker().filter(function (entry) {
              return entry.date !== date;
            })
          );
          renderTracker();
          toast("Entrée supprimée.");
        });
      });
    }

    function buildChart(weights) {
      var width = 640;
      var height = 200;
      var pad = 30;
      var values = weights.map(function (entry) {
        return entry.poids;
      });
      var min = Math.min.apply(null, values);
      var max = Math.max.apply(null, values);
      var span = max - min || 1;
      var step = (width - pad * 2) / Math.max(1, weights.length - 1);

      var points = weights.map(function (entry, index) {
        var x = pad + step * index;
        var y = height - pad - ((entry.poids - min) / span) * (height - pad * 2);
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, entry: entry };
      });

      var line = points
        .map(function (point) {
          return point.x + "," + point.y;
        })
        .join(" ");
      var area =
        pad + "," + (height - pad) + " " + line + " " + points[points.length - 1].x + "," + (height - pad);

      var dots = points
        .map(function (point) {
          return '<circle cx="' + point.x + '" cy="' + point.y + '" r="4" fill="#ff2233" stroke="#08080a" stroke-width="2"></circle>';
        })
        .join("");

      return (
        '<svg viewBox="0 0 ' +
        width +
        " " +
        height +
        '" role="img" aria-label="Évolution du poids">' +
        '<defs><linearGradient id="trackerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e2001a" stop-opacity=".45"></stop><stop offset="100%" stop-color="#e2001a" stop-opacity="0"></stop></linearGradient></defs>' +
        '<polygon points="' +
        area +
        '" fill="url(#trackerFill)"></polygon>' +
        '<polyline points="' +
        line +
        '" fill="none" stroke="#ff2233" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>' +
        dots +
        '<text x="' +
        pad +
        '" y="' +
        (height - pad + 20) +
        '" fill="#74747f" font-size="12" font-family="Inter, sans-serif">' +
        escapeHtml(formatDate(weights[0].date)) +
        "</text>" +
        '<text x="' +
        (width - pad) +
        '" y="' +
        (height - pad + 20) +
        '" fill="#74747f" font-size="12" text-anchor="end" font-family="Inter, sans-serif">' +
        escapeHtml(formatDate(weights[weights.length - 1].date)) +
        "</text>" +
        '<text x="' +
        pad +
        '" y="18" fill="#ffffff" font-size="13" font-family="Inter, sans-serif">' +
        Math.max.apply(null, values) +
        " kg</text>" +
        '<text x="' +
        pad +
        '" y="' +
        (height - pad - 6) +
        '" fill="#74747f" font-size="13" font-family="Inter, sans-serif">' +
        Math.min.apply(null, values) +
        " kg</text>" +
        "</svg>"
      );
    }

    if (trackerForm) {
      trackerForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var poids = firstNumber(fieldValue("trackPoids"));
        var taille = firstNumber(fieldValue("trackTaille"));
        var pas = firstNumber(fieldValue("trackPas"));
        var date = (trackDate && trackDate.value) || new Date().toISOString().slice(0, 10);

        if (isNaN(poids) && isNaN(taille) && isNaN(pas)) {
          toast("Renseigne au moins une valeur (poids, taille ou pas).");
          return;
        }

        var existantes = readTracker();
        var remplacee = existantes.some(function (entry) {
          return entry.date === date;
        });
        var list = existantes.filter(function (entry) {
          return entry.date !== date;
        });
        list.push({
          date: date,
          poids: isNaN(poids) ? null : poids,
          taille: isNaN(taille) ? null : taille,
          pas: isNaN(pas) ? null : Math.round(pas),
        });
        writeTracker(list);
        renderTracker();
        ["trackPoids", "trackTaille", "trackPas"].forEach(function (id) {
          var field = document.getElementById(id);
          if (field) field.value = "";
        });          toast(
            remplacee
              ? "Entrée du " + formatDate(date) + " mise à jour."
              : "Entrée enregistrée pour le " + formatDate(date) + "."
          );
      });
    }

    if (localStore(CLIENT_ACCESS_KEY) === "1") openClientPanel();
  }

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
