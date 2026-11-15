import "./style.css";
import { CURRENCIES, summarize, toLocal, type Currency, type Entry, type Trip } from "./budget";
import { fetchRate } from "./rates";
import { loadTrip, saveTrip } from "./storage";

const app = document.querySelector<HTMLElement>("#app")!;
const dialog = document.querySelector<HTMLDialogElement>("#dialog")!;

let trip = loadTrip();
let online = navigator.onLine;

// ---------- utilitaires ----------

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = (n: number, c: Currency) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: c }).format(n);

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

const fmtDate = (iso: string, withTime = false) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

const parseAmount = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));

const currencyOptions = (selected: Currency) =>
  CURRENCIES.map((c) => `<option ${c === selected ? "selected" : ""}>${c}</option>`).join("");

function persist() {
  saveTrip(trip);
  render();
}

// ---------- taux ----------

async function refreshRate() {
  if (!trip) return;
  try {
    const value = await fetchRate(trip.local, trip.foreign);
    trip.rate = { value, fetchedAt: new Date().toISOString(), manual: false };
    online = true;
    persist();
  } catch {
    online = false;
    render();
  }
}

// ---------- écran de démarrage ----------

function renderSetup() {
  const today = todayYmd();
  app.innerHTML = `
    <header class="top"><h1>BuddyBudget</h1></header>
    <form id="setup" class="card stack">
      <h2>Nouveau voyage</h2>
      <div class="row">
        <label>Départ<input type="date" name="start" value="${today}" required /></label>
        <label>Retour<input type="date" name="end" value="${today}" required /></label>
      </div>
      <div class="row">
        <label>Devise locale<select name="local">${currencyOptions("CAD")}</select></label>
        <label>Devise étrangère<select name="foreign">${currencyOptions("EUR")}</select></label>
      </div>
      <label><span>Budget (<span id="budget-cur">CAD</span>)</span>
        <input type="number" name="budget" inputmode="decimal" step="0.01" min="0" required />
      </label>
      <label><span>Taux : 1 <span id="rate-from">CAD</span> = ? <span id="rate-to">EUR</span></span>
        <input type="number" name="rate" inputmode="decimal" step="any" min="0" required />
      </label>
      <p class="hint" id="rate-hint">Récupération du taux…</p>
      <button class="primary" type="submit">Démarrer</button>
    </form>`;

  const form = app.querySelector<HTMLFormElement>("#setup")!;
  const local = form.elements.namedItem("local") as HTMLSelectElement;
  const foreign = form.elements.namedItem("foreign") as HTMLSelectElement;
  const rate = form.elements.namedItem("rate") as HTMLInputElement;
  const hint = form.querySelector("#rate-hint")!;
  let fetched = false;

  const updateRate = async () => {
    form.querySelector("#budget-cur")!.textContent = local.value;
    form.querySelector("#rate-from")!.textContent = local.value;
    form.querySelector("#rate-to")!.textContent = foreign.value;
    hint.textContent = "Récupération du taux…";
    try {
      const v = await fetchRate(local.value as Currency, foreign.value as Currency);
      rate.value = String(v);
      fetched = true;
      hint.textContent = "Taux du jour récupéré. Tu peux le modifier.";
    } catch {
      fetched = false;
      hint.textContent = "Pas de réseau : saisis le taux à la main.";
    }
  };
  local.addEventListener("change", updateRate);
  foreign.addEventListener("change", updateRate);
  updateRate();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const start = String(f.get("start"));
    const end = String(f.get("end"));
    if (end < start) {
      alert("La date de retour doit être après le départ.");
      return;
    }
    const value = parseAmount(f.get("rate"));
    trip = {
      start,
      end,
      initialBudget: parseAmount(f.get("budget")),
      local: local.value as Currency,
      foreign: foreign.value as Currency,
      rate: { value, fetchedAt: new Date().toISOString(), manual: !fetched },
      entries: [],
    };
    persist();
  });
}

// ---------- écran principal ----------

function renderMain(t: Trip) {
  const s = summarize(t, todayYmd());
  const rate = t.rate.value;
  const both = (local: number) =>
    `${money(local * rate, t.foreign)} <small>${money(local, t.local)}</small>`;
  const neg = s.balanceLocal < 0;

  let perDay = "";
  if (s.phase === "after") {
    perDay = `<p class="label">Voyage terminé. ${neg ? "Dépassement" : "Reste"} : ${money(Math.abs(s.balanceLocal), t.local)}</p>`;
  } else {
    const remaining = s.remainingPerDayLocal ?? 0;
    perDay = `
      <div class="perday">
        <div><span class="label">Prévu / jour</span><strong>${both(s.plannedPerDayLocal)}</strong></div>
        <div class="${remaining < s.plannedPerDayLocal ? "neg" : ""}">
          <span class="label">${s.phase === "before" ? "Dispo / jour" : "Reste / jour"}</span>
          <strong>${both(remaining)}</strong>
        </div>
      </div>
      <p class="hint">${
        s.phase === "before"
          ? `Départ le ${fmtDate(t.start)} · ${s.days} jours`
          : `${s.remainingDays} jour${s.remainingDays > 1 ? "s" : ""} restant${s.remainingDays > 1 ? "s" : ""} sur ${s.days}`
      }</p>`;
  }

  const entries = [...t.entries].sort((a, b) => b.date.localeCompare(a.date));
  const list = entries.length
    ? entries
        .map((e) => {
          const sign = e.kind === "purchase" ? "−" : "+";
          const other = e.currency === t.local ? t.foreign : t.local;
          const otherAmount = e.currency === t.local ? e.amount * e.rate : toLocal(t, e);
          return `
          <li class="entry ${e.kind}" data-id="${e.id}">
            <div>
              <span class="note">${esc(e.note) || (e.kind === "purchase" ? "Achat" : "Recharge")}</span>
              <span class="hint">${fmtDate(e.date, true)}</span>
            </div>
            <div class="amt">
              <span>${sign} ${money(e.amount, e.currency)}</span>
              ${e.currency !== other ? `<span class="hint">${money(otherAmount, other)}</span>` : ""}
            </div>
          </li>`;
        })
        .join("")
    : `<li class="empty">Aucune dépense pour l'instant.</li>`;

  app.innerHTML = `
    <header class="top">
      <h1>BuddyBudget</h1>
      <span class="hint">${fmtDate(t.start)} → ${fmtDate(t.end)}</span>
    </header>
    <section class="card balance ${neg ? "neg" : ""}">
      <span class="label">Balance</span>
      <div class="big">${money(s.balanceForeign, t.foreign)}</div>
      <div class="sub">${money(s.balanceLocal, t.local)}</div>
      ${perDay}
    </section>
    <div class="actions">
      <button class="primary" id="add-purchase">+ Achat</button>
      <button id="add-topup">+ Recharge</button>
    </div>
    <ul class="card list">${list}</ul>
    <section class="card rate">
      <div>
        <span class="label">Taux</span>
        <strong>1 ${t.local} = ${rate.toFixed(4)} ${t.foreign}</strong>
        <span class="hint">${t.rate.manual ? "Saisi à la main" : "Récupéré"} le ${fmtDate(t.rate.fetchedAt, true)}${online ? "" : " · hors-ligne"}</span>
      </div>
      <button id="edit-rate">Modifier</button>
    </section>
    <button class="danger" id="end-trip">Terminer le voyage</button>`;

  app.querySelector("#add-purchase")!.addEventListener("click", () => openEntry(t, "purchase"));
  app.querySelector("#add-topup")!.addEventListener("click", () => openEntry(t, "topup"));
  app.querySelector("#edit-rate")!.addEventListener("click", () => openRate(t));
  app.querySelector("#end-trip")!.addEventListener("click", () => {
    if (confirm("Terminer ce voyage et effacer toutes ses données ?")) {
      trip = null;
      persist();
    }
  });
  app.querySelectorAll<HTMLElement>(".entry").forEach((li) =>
    li.addEventListener("click", () => {
      const e = t.entries.find((x) => x.id === li.dataset.id);
      if (e) openEntry(t, e.kind, e);
    }),
  );
}

// ---------- dialogues ----------

function openEntry(t: Trip, kind: Entry["kind"], existing?: Entry) {
  const label = kind === "purchase" ? "Achat" : "Recharge";
  const cur = existing?.currency ?? (kind === "purchase" ? t.foreign : t.local);
  const currencies = [t.foreign, t.local].filter((c, i, a) => a.indexOf(c) === i);
  dialog.innerHTML = `
    <form method="dialog" class="stack">
      <h2>${existing ? `Modifier ${label.toLowerCase()}` : label}</h2>
      <div class="row amount-row">
        <label>Montant<input type="number" name="amount" inputmode="decimal" step="0.01" min="0" required value="${existing?.amount ?? ""}" /></label>
        <label>Devise<select name="currency">${currencies.map((c) => `<option ${c === cur ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      </div>
      <label>Note (facultatif)<input type="text" name="note" maxlength="80" value="${esc(existing?.note ?? "")}" /></label>
      <div class="actions">
        ${existing ? `<button type="button" class="danger" id="del">Supprimer</button>` : ""}
        <button type="button" id="cancel">Annuler</button>
        <button class="primary" type="submit">Enregistrer</button>
      </div>
    </form>`;
  const form = dialog.querySelector("form")!;
  dialog.querySelector("#cancel")!.addEventListener("click", () => dialog.close());
  dialog.querySelector("#del")?.addEventListener("click", () => {
    if (!existing || !confirm("Supprimer cette entrée ?")) return;
    t.entries = t.entries.filter((x) => x.id !== existing.id);
    dialog.close();
    persist();
  });
  form.addEventListener("submit", () => {
    const f = new FormData(form);
    const amount = parseAmount(f.get("amount"));
    if (!(amount > 0)) return;
    const data = {
      amount,
      currency: String(f.get("currency")) as Currency,
      note: String(f.get("note") ?? "").trim(),
    };
    if (existing) Object.assign(existing, data);
    else
      t.entries.push({
        id: crypto.randomUUID(),
        kind,
        rate: t.rate.value,
        date: new Date().toISOString(),
        ...data,
      });
    persist();
  });
  dialog.showModal();
  dialog.querySelector<HTMLInputElement>("input[name=amount]")!.focus();
}

function openRate(t: Trip) {
  dialog.innerHTML = `
    <form method="dialog" class="stack">
      <h2>Taux de change</h2>
      <label>1 ${t.local} = ? ${t.foreign}
        <input type="number" name="rate" inputmode="decimal" step="any" min="0" required value="${t.rate.value}" />
      </label>
      <p class="hint">Le nouveau taux s'applique aux prochaines entrées. Les entrées déjà saisies gardent leur taux.</p>
      <div class="actions">
        <button type="button" id="fetch">Récupérer</button>
        <button type="button" id="cancel">Annuler</button>
        <button class="primary" type="submit">Enregistrer</button>
      </div>
    </form>`;
  const form = dialog.querySelector("form")!;
  const input = form.elements.namedItem("rate") as HTMLInputElement;
  dialog.querySelector("#cancel")!.addEventListener("click", () => dialog.close());
  dialog.querySelector("#fetch")!.addEventListener("click", async () => {
    try {
      input.value = String(await fetchRate(t.local, t.foreign));
    } catch {
      alert("Pas de réseau.");
    }
  });
  form.addEventListener("submit", () => {
    const value = parseAmount(input.value);
    if (!(value > 0)) return;
    t.rate = { value, fetchedAt: new Date().toISOString(), manual: true };
    persist();
  });
  dialog.showModal();
}

// ---------- démarrage ----------

function render() {
  if (trip) renderMain(trip);
  else renderSetup();
}

render();
refreshRate();
window.addEventListener("online", refreshRate);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    render();
    refreshRate();
  }
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("./sw.js");
}
