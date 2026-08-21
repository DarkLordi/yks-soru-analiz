const SUBJECTS = [
  { id: "turkce", label: "Türkçe", tracks: ["TYT"] },
  { id: "edebiyat", label: "Edebiyat", tracks: ["AYT"] },
  { id: "matematik", label: "Matematik", tracks: ["TYT", "AYT"] },
  { id: "geometri", label: "Geometri", tracks: ["TYT", "AYT"] },
  { id: "fizik", label: "Fizik", tracks: ["TYT", "AYT"] },
  { id: "kimya", label: "Kimya", tracks: ["TYT", "AYT"] },
  { id: "biyoloji", label: "Biyoloji", tracks: ["TYT", "AYT"] },
  { id: "tarih", label: "Tarih", tracks: ["TYT", "AYT"] },
  { id: "tarih2", label: "Tarih-2", tracks: ["AYT"] },
  { id: "cografya", label: "Coğrafya", tracks: ["TYT", "AYT"] },
  { id: "cografya2", label: "Coğrafya-2", tracks: ["AYT"] },
  { id: "felsefe", label: "Felsefe Grubu", tracks: ["TYT", "AYT"] },
  { id: "din", label: "Din Kültürü", tracks: ["TYT", "AYT"] },
  { id: "ingilizce", label: "İngilizce", tracks: ["YDT"] },
];

const TRACKS = ["TYT", "AYT", "YDT"];
const RANGES = [7, 30, 90];
const TRACK_COLORS = {
  TYT: "#c24a2a",
  AYT: "#c9a227",
  YDT: "#2f6b4f",
};

const state = {
  date: todayISO(),
  track: "TYT",
  range: 30,
  rangeStart: null,
  rangeEnd: null,
  notes: "",
  counts: emptyCounts(),
  logs: [],
};

let lineChart;
let barChart;
let dayChart;

function emptyRow() {
  return { correct: 0, wrong: 0, blank: 0 };
}

function emptyCounts() {
  return Object.fromEntries(
    SUBJECTS.map((subject) => [
      subject.id,
      Object.fromEntries(TRACKS.map((track) => [track, emptyRow()])),
    ]),
  );
}

function isLegacyRow(row) {
  return row != null && typeof row.correct === "number" && row.TYT == null && row.AYT == null;
}

function normalizeCounts(raw) {
  const counts = emptyCounts();
  if (!raw) return counts;
  for (const subject of SUBJECTS) {
    const row = raw[subject.id];
    if (!row) continue;
    if (isLegacyRow(row)) {
      const track = subject.tracks[0];
      counts[subject.id][track] = {
        correct: clamp(row.correct),
        wrong: clamp(row.wrong),
        blank: clamp(row.blank),
      };
      continue;
    }
    for (const track of TRACKS) {
      const cell = row[track];
      if (!cell) continue;
      counts[subject.id][track] = {
        correct: clamp(cell.correct),
        wrong: clamp(cell.wrong),
        blank: clamp(cell.blank),
      };
    }
  }
  return counts;
}

function addCounts(base, extra) {
  const counts = emptyCounts();
  const left = normalizeCounts(base);
  const right = normalizeCounts(extra);
  for (const subject of SUBJECTS) {
    for (const track of TRACKS) {
      counts[subject.id][track] = {
        correct: left[subject.id][track].correct + right[subject.id][track].correct,
        wrong: left[subject.id][track].wrong + right[subject.id][track].wrong,
        blank: left[subject.id][track].blank + right[subject.id][track].blank,
      };
    }
  }
  return counts;
}

function todayISO() {
  return toISODate(new Date());
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateTR(iso) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric",
  }).format(parseISO(iso));
}

function shortDate(iso) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(parseISO(iso));
}

function clamp(value) {
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(999, Math.round(n));
}

function rowTotal(row) {
  return (row?.correct ?? 0) + (row?.wrong ?? 0) + (row?.blank ?? 0);
}

function trackTotal(counts, subjectId, track) {
  return rowTotal(normalizeCounts(counts)[subjectId][track]);
}

function totalSolved(counts) {
  const normalized = normalizeCounts(counts);
  let sum = 0;
  for (const subject of SUBJECTS) {
    for (const track of TRACKS) {
      sum += rowTotal(normalized[subject.id][track]);
    }
  }
  return sum;
}

function netScore(counts) {
  const normalized = normalizeCounts(counts);
  let correct = 0;
  let wrong = 0;
  for (const subject of SUBJECTS) {
    for (const track of TRACKS) {
      const row = normalized[subject.id][track];
      correct += row.correct;
      wrong += row.wrong;
    }
  }
  return Number((correct - wrong / 4).toFixed(2));
}

function savedCountsForDate(date) {
  const log = state.logs.find((item) => item.date === date);
  return normalizeCounts(log?.counts);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Sunucu ${response.status}`);
  }
  return response.json();
}

async function getLog(date) {
  return api(`/api/logs?date=${encodeURIComponent(date)}`);
}

async function getAllLogs() {
  const logs = await api("/api/logs");
  return logs.map((log) => ({ ...log, counts: normalizeCounts(log.counts) }));
}

function readLegacyIndexedDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve([]);
      return;
    }
    const request = indexedDB.open("yksSoruDefteri", 1);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("logs")) {
        database.close();
        resolve([]);
        return;
      }
      const tx = database.transaction("logs", "readonly");
      const read = tx.objectStore("logs").getAll();
      read.onsuccess = () => {
        database.close();
        resolve(read.result ?? []);
      };
      read.onerror = () => {
        database.close();
        resolve([]);
      };
    };
  });
}

async function migrateFromIndexedDB() {
  const existing = await getAllLogs();
  if (existing.length) return 0;
  const legacy = await readLegacyIndexedDB();
  if (!legacy.length) return 0;
  for (const log of legacy) {
    await api("/api/logs", {
      method: "PUT",
      body: JSON.stringify({
        date: log.date,
        notes: log.notes ?? "",
        counts: log.counts,
        updatedAt: log.updatedAt ?? Date.now(),
      }),
    });
  }
  return legacy.length;
}

function resetTable() {
  state.counts = emptyCounts();
  renderSubjects();
}

async function saveLog() {
  const incoming = totalSolved(state.counts);
  if (incoming === 0 && !state.notes.trim()) {
    setStatus("Kaydedilecek yeni soru yok.");
    resetTable();
    renderStats();
    return;
  }

  const existing = await getLog(state.date);
  const record = {
    date: state.date,
    notes: state.notes.trim() || existing?.notes || "",
    counts: addCounts(existing?.counts, state.counts),
    updatedAt: Date.now(),
  };
  await api("/api/logs", { method: "PUT", body: JSON.stringify(record) });
  state.logs = await getAllLogs();
  resetTable();
  setStatus(`${formatDateTR(state.date)} kaydı işlendi. Tablo yeni giriş için sıfırlandı.`);
  renderCharts();
  renderStats();
}

async function deleteLog() {
  await api(`/api/logs?date=${encodeURIComponent(state.date)}`, { method: "DELETE" });
  state.notes = "";
  document.querySelector("#notes").value = "";
  state.logs = await getAllLogs();
  resetTable();
  setStatus(`${formatDateTR(state.date)} kaydı silindi.`);
  renderCharts();
  renderStats();
}

async function loadDate(date) {
  state.date = date;
  const log = await getLog(date);
  state.notes = log?.notes ?? "";
  document.querySelector("#date").value = date;
  document.querySelector("#date-label").textContent = formatDateTR(date);
  document.querySelector("#notes").value = state.notes;
  resetTable();
  renderStats();
  renderCharts();
}

function setStatus(text) {
  document.querySelector("#status").textContent = text;
}

function renderTracks() {
  const root = document.querySelector("#tracks");
  root.innerHTML = "";
  for (const track of TRACKS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${state.track === track ? "active" : ""}`;
    button.textContent = track;
    button.addEventListener("click", () => {
      state.track = track;
      renderTracks();
      renderSubjects();
    });
    root.append(button);
  }
}

function renderRange() {
  const root = document.querySelector("#range");
  root.innerHTML = "";
  for (const days of RANGES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${!state.rangeStart && !state.rangeEnd && state.range === days ? "active" : ""}`;
    button.textContent = `${days}g`;
    button.addEventListener("click", () => {
      state.range = days;
      state.rangeStart = null;
      state.rangeEnd = null;
      renderRange();
      renderCharts();
    });
    root.append(button);
  }

  const customButton = document.createElement("button");
  customButton.type = "button";
  customButton.className = `chip ${state.rangeStart && state.rangeEnd ? "active" : ""}`;
  customButton.textContent = state.rangeStart && state.rangeEnd
    ? `${shortDate(state.rangeStart)} → ${shortDate(state.rangeEnd)}`
    : "Tarih aralığı";
  customButton.addEventListener("click", () => {
    const start = window.prompt(
      "Başlangıç tarihini seçin (YYYY-MM-DD):",
      state.rangeStart ?? todayISO(),
    );
    if (!start) return;
    const end = window.prompt(
      "Bitiş tarihini seçin (YYYY-MM-DD):",
      state.rangeEnd ?? todayISO(),
    );
    if (!end) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      window.alert("Tarih formatı YYYY-MM-DD olmalıdır.");
      return;
    }
    state.rangeStart = start;
    state.rangeEnd = end;
    renderRange();
    renderCharts();
  });
  root.append(customButton);
}

function renderSubjects() {
  const root = document.querySelector("#subjects");
  root.innerHTML = "";
  const visible = SUBJECTS.filter((subject) => subject.tracks.includes(state.track));
  for (const subject of visible) {
    const row = state.counts[subject.id][state.track];
    const article = document.createElement("article");
    article.className = "subject";
    article.innerHTML = `
      <div>
        <strong>${subject.label}</strong>
        <span class="total">${rowTotal(row)} soru</span>
      </div>
      <div class="counters"></div>
    `;
    const counters = article.querySelector(".counters");
    for (const field of [
      ["correct", "Doğru"],
      ["wrong", "Yanlış"],
      ["blank", "Boş"],
    ]) {
      counters.append(createCounter(subject.id, field[0], field[1], row[field[0]]));
    }
    root.append(article);
  }
}

function createCounter(subjectId, field, label, value) {
  const wrap = document.createElement("div");
  wrap.className = "counter";
  wrap.innerHTML = `
    <div class="label">${label}</div>
    <div class="row">
      <button type="button" aria-label="${label} azalt">−</button>
      <input inputmode="numeric" value="${value}" />
      <button type="button" aria-label="${label} artır">+</button>
    </div>
  `;
  const [minus, input, plus] = wrap.querySelectorAll("button, input");
  minus.addEventListener("click", () => setCount(subjectId, field, value - 1));
  plus.addEventListener("click", () => setCount(subjectId, field, value + 1));
  input.addEventListener("change", () => setCount(subjectId, field, input.value));
  return wrap;
}

function setCount(subjectId, field, value) {
  state.counts[subjectId][state.track][field] = clamp(value);
  renderSubjects();
  renderStats();
}

function calcStreak(logs) {
  const dates = new Set(
    logs.filter((log) => totalSolved(log.counts) > 0).map((log) => log.date),
  );
  let cursor = todayISO();
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    const next = parseISO(cursor);
    next.setDate(next.getDate() - 1);
    cursor = toISODate(next);
  }
  return streak;
}

function renderStats() {
  const selected = addCounts(savedCountsForDate(state.date), state.counts);
  document.querySelector("#stat-day").textContent = String(totalSolved(selected));
  document.querySelector("#stat-net").textContent = String(netScore(selected));
  document.querySelector("#stat-all").textContent = String(
    state.logs.reduce((sum, log) => sum + totalSolved(log.counts), 0) +
      totalSolved(state.counts),
  );
  document.querySelector("#streak").textContent =
    `Kesintisiz seri: ${calcStreak(state.logs)} gün · ${state.logs.length} kayıtlı gün`;
}

function chartPoints() {
  const byDate = new Map(state.logs.map((log) => [log.date, log]));
  const days = [];
  const rangeDates = [];

  if (state.rangeStart && state.rangeEnd) {
    const start = parseISO(state.rangeStart);
    const end = parseISO(state.rangeEnd);
    const cursor = new Date(Math.min(start.getTime(), end.getTime()));
    const limit = new Date(Math.max(start.getTime(), end.getTime()));
    while (cursor <= limit) {
      rangeDates.push(toISODate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  } else {
    for (let offset = state.range - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      rangeDates.push(toISODate(day));
    }
  }

  for (const iso of rangeDates) {
    const log = byDate.get(iso);
    const counts = log?.counts ?? emptyCounts();
    days.push({
      label: shortDate(iso),
      soru: totalSolved(counts),
      net: netScore(counts),
    });
  }

  return days;
}

function subjectBars() {
  return SUBJECTS.map((subject) => {
    const row = { label: subject.label, TYT: 0, AYT: 0, YDT: 0 };
    for (const log of state.logs) {
      for (const track of TRACKS) {
        row[track] += trackTotal(log.counts, subject.id, track);
      }
    }
    return row;
  }).filter((row) => row.TYT + row.AYT + row.YDT > 0);
}

function selectedDayBars() {
  const current = addCounts(savedCountsForDate(state.date), state.counts);
  return SUBJECTS.map((subject) => {
    const total = TRACKS.reduce((sum, track) => sum + trackTotal(current, subject.id, track), 0);
    return {
      label: subject.label,
      total,
    };
  }).filter((row) => row.total > 0);
}

function renderCharts() {
  const points = chartPoints();
  const bars = subjectBars();
  const selectedDay = selectedDayBars();
  const hasLogs = state.logs.length > 0;
  const hasSelectedDayData = selectedDay.length > 0;
  document.querySelector("#line-empty").classList.toggle("visible", !hasLogs);
  document.querySelector("#bar-empty").classList.toggle("visible", bars.length === 0);
  document.querySelector("#day-empty").classList.toggle("visible", !hasSelectedDayData);
  document.querySelector("#line-chart").style.display = hasLogs ? "block" : "none";
  document.querySelector("#bar-chart").style.display = bars.length ? "block" : "none";
  document.querySelector("#day-chart").style.display = hasSelectedDayData ? "block" : "none";

  const grid = "#ead9b8";
  const common = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: "#241c14" } } },
    scales: {
      x: { ticks: { color: "#5a4b3b" }, grid: { color: grid } },
      y: { ticks: { color: "#5a4b3b" }, grid: { color: grid }, beginAtZero: true },
    },
  };

  if (lineChart) lineChart.destroy();
  if (hasLogs) {
    lineChart = new Chart(document.querySelector("#line-chart"), {
      type: "line",
      data: {
        labels: points.map((point) => point.label),
        datasets: [
          {
            label: "soru",
            data: points.map((point) => point.soru),
            borderColor: "#c24a2a",
            backgroundColor: "rgba(194, 74, 42, 0.12)",
            tension: 0.35,
            fill: true,
            pointRadius: 0,
          },
          {
            label: "net",
            data: points.map((point) => point.net),
            borderColor: "#2f6b4f",
            tension: 0.35,
            pointRadius: 0,
          },
        ],
      },
      options: common,
    });
  }

  if (barChart) {
    barChart.destroy();
    barChart = undefined;
  }
  if (bars.length) {
    const stackedMax = Math.max(
      ...bars.map((row) => row.TYT + row.AYT + row.YDT),
      1,
    );
    const datasets = TRACKS.map((track) => ({
      label: track,
      data: bars.map((row) => row[track]),
      backgroundColor: TRACK_COLORS[track],
      borderRadius: 4,
      stack: "soru",
    })).filter((dataset) => dataset.data.some((value) => value > 0));

    barChart = new Chart(document.querySelector("#bar-chart"), {
      type: "bar",
      data: {
        labels: bars.map((row) => row.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#241c14" } },
        },
        scales: {
          x: {
            stacked: true,
            ticks: { color: "#5a4b3b" },
            grid: { display: false },
          },
          y: {
            stacked: true,
            type: "linear",
            beginAtZero: true,
            suggestedMax: stackedMax,
            ticks: { color: "#5a4b3b", precision: 0 },
            grid: { color: grid },
          },
        },
      },
    });
  }

  if (dayChart) {
    dayChart.destroy();
    dayChart = undefined;
  }

  if (selectedDay.length) {
    dayChart = new Chart(document.querySelector("#day-chart"), {
      type: "bar",
      data: {
        labels: selectedDay.map((row) => row.label),
        datasets: [
          {
            label: "soru",
            data: selectedDay.map((row) => row.total),
            backgroundColor: selectedDay.map((row) => {
              const total = row.total;
              if (total <= 15) return "#d9a26a";
              if (total <= 30) return "#c24a2a";
              return "#7e3d2d";
            }),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false, labels: { color: "#241c14" } },
        },
        scales: {
          x: {
            ticks: { color: "#5a4b3b" },
            grid: { display: false },
          },
          y: {
            type: "linear",
            beginAtZero: true,
            ticks: { color: "#5a4b3b", precision: 0 },
            grid: { color: grid },
          },
        },
      },
    });
  }
}

async function start() {
  if (location.protocol === "file:") {
    throw new Error("file");
  }
  const moved = await migrateFromIndexedDB();
  state.logs = await getAllLogs();
  if (moved) {
    setStatus(`${moved} eski tarayıcı kaydı ortak veritabanına aktarıldı.`);
  }

  const dateInput = document.querySelector("#date");
  dateInput.max = todayISO();
  dateInput.addEventListener("change", () => loadDate(dateInput.value));

  document.querySelector("#notes").addEventListener("input", (event) => {
    state.notes = event.target.value;
  });
  document.querySelector("#save").addEventListener("click", () => saveLog());
  document.querySelector("#today").addEventListener("click", () => loadDate(todayISO()));
  document.querySelector("#delete").addEventListener("click", () => deleteLog());

  renderTracks();
  renderRange();
  await loadDate(todayISO());
  renderCharts();
}

start().catch((error) => {
  setStatus("Ortak veritabanı için klasörde python3 server.py çalıştırıp http://127.0.0.1:5173 adresini aç.");
  console.error(error);
});
