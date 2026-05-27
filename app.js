const FORMS = ["present", "past", "participle"];
const LABELS = {
  present: "Presente",
  past: "Pasado",
  participle: "Participio",
};

const els = {
  form: document.getElementById("game-form"),
  fields: Object.fromEntries(
    FORMS.map((key) => [key, document.querySelector(`.field[data-form="${key}"]`)])
  ),
  inputs: Object.fromEntries(FORMS.map((key) => [key, document.getElementById(key)])),
  feedback: document.getElementById("feedback"),
  btnTry: document.getElementById("btn-try"),
  btnCheck: document.getElementById("btn-check"),
  btnSkip: document.getElementById("btn-skip"),
  btnReveal: document.getElementById("btn-reveal"),
  streak: document.getElementById("streak"),
  correct: document.getElementById("correct"),
  total: document.getElementById("total"),
  loadError: document.getElementById("load-error"),
};

let verbs = [];
let current = null;
let revealed = null;
let answerRevealed = false;
let lastOutcome = null;
let stats = { streak: 0, correct: 0, total: 0 };

function normalize(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function acceptedAnswers(correct) {
  return normalize(correct)
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesAny(userValue, correct) {
  const user = normalize(userValue);
  if (!user) return false;
  return acceptedAnswers(correct).some(
    (answer) => user === answer || user.replace(/\s/g, "") === answer.replace(/\s/g, "")
  );
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function resetFields() {
  FORMS.forEach((key) => {
    const field = els.fields[key];
    const input = els.inputs[key];
    field.classList.remove("given", "correct", "wrong");
    input.value = "";
    input.readOnly = false;
    input.disabled = false;
  });
  hideFeedback();
}

function hideFeedback() {
  els.feedback.hidden = true;
  els.feedback.className = "feedback";
  els.feedback.textContent = "";
}

function showFeedback(text, kind) {
  els.feedback.hidden = false;
  els.feedback.className = `feedback is-visible ${kind}`;
  els.feedback.textContent = text;
}

/** @param {"idle" | "playing" | "ended"} phase */
function setPhase(phase, { outcome = null } = {}) {
  const playing = phase === "playing";
  const ended = phase === "ended";
  const failed = outcome === "wrong" || outcome === "skipped";

  els.btnTry.hidden = playing;
  els.btnTry.textContent = failed ? "Jugar otra vez" : "Jugar";
  els.btnCheck.hidden = !playing;
  els.btnSkip.hidden = !playing;
  els.btnCheck.disabled = !playing;
  els.btnSkip.disabled = !playing;
  els.btnReveal.hidden = !ended || !failed || answerRevealed;
}

function lockInputs() {
  FORMS.forEach((key) => {
    els.inputs[key].readOnly = true;
  });
}

function revealAnswers() {
  if (!current || answerRevealed) return;

  FORMS.forEach((key) => {
    if (key !== revealed && !els.fields[key].classList.contains("correct")) {
      els.inputs[key].value = current[key];
      els.fields[key].classList.add("wrong");
    }
  });

  answerRevealed = true;
  showFeedback(
    `${FORMS.map((k) => `${LABELS[k]}: ${current[k]}`).join(" · ")}`,
    "info"
  );
  setPhase("ended", { outcome: lastOutcome });
}

function endRound(outcome) {
  lastOutcome = outcome;
  lockInputs();
  updateStats();
  setPhase("ended", { outcome });
  els.btnTry.focus();
}

function newRound() {
  if (!verbs.length) return;

  current = pickRandom(verbs);
  revealed = pickRandom(FORMS);
  answerRevealed = false;
  lastOutcome = null;
  resetFields();

  FORMS.forEach((key) => {
    if (key === revealed) {
      els.fields[key].classList.add("given");
      els.inputs[key].value = current[key];
      els.inputs[key].readOnly = true;
    }
  });

  const firstEmpty = FORMS.find((key) => key !== revealed);
  els.inputs[firstEmpty].focus();
  setPhase("playing");
}

function checkAnswers() {
  if (!current) return;

  const results = FORMS.filter((key) => key !== revealed).map((key) => ({
    key,
    ok: matchesAny(els.inputs[key].value, current[key]),
  }));

  const allOk = results.every((r) => r.ok);
  stats.total += 1;

  results.forEach(({ key, ok }) => {
    els.fields[key].classList.add(ok ? "correct" : "wrong");
  });

  if (allOk) {
    stats.correct += 1;
    stats.streak += 1;
    showFeedback("¡Correcto!", "ok");
    endRound("correct");
  } else {
    stats.streak = 0;
    showFeedback("Algunas respuestas no coinciden.", "bad");
    endRound("wrong");
  }
}

function skipRound() {
  if (!current) return;

  stats.total += 1;
  stats.streak = 0;

  showFeedback("Saltaste esta ronda.", "info");
  endRound("skipped");
}

function updateStats() {
  els.streak.textContent = String(stats.streak);
  els.correct.textContent = String(stats.correct);
  els.total.textContent = String(stats.total);
}

els.btnTry.addEventListener("click", newRound);
els.btnSkip.addEventListener("click", skipRound);
els.btnReveal.addEventListener("click", revealAnswers);
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!els.btnCheck.hidden) checkAnswers();
});

async function init() {
  try {
    const res = await fetch("./verbs.json");
    if (!res.ok) throw new Error(res.statusText);
    verbs = await res.json();
  } catch {
    els.loadError.hidden = false;
    els.btnTry.disabled = true;
    return;
  }

  setPhase("idle");
  updateStats();
}

init();
