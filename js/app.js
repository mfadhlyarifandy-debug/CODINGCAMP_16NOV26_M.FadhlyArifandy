/* ============================================================
   To-Do List Life Dashboard — app.js
   Vanilla JavaScript + Local Storage, tanpa library eksternal.
   ============================================================ */

"use strict";

/* ============================================================
   Bagian 1: Util & Local Storage helpers
   ============================================================ */

const STORAGE_KEYS = {
  todos: "lifeDash.todos",
  links: "lifeDash.links",
  theme: "lifeDash.theme",
  name: "lifeDash.name",
};

const DEFAULT_LINKS = [
  { name: "Google", url: "https://www.google.com" },
  { name: "Gmail", url: "https://mail.google.com" },
  { name: "Calendar", url: "https://calendar.google.com" },
];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function $(id) {
  return document.getElementById(id);
}

/* ============================================================
   Bagian 2: Tema (Light / Dark Mode)
   ============================================================ */

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved === "dark" || (saved === null && prefersDark) ? "dark" : "light");
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
  $("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  setTheme(current === "dark" ? "light" : "dark");
}

/* ============================================================
   Bagian 3: Greeting Widget (jam, tanggal, nama custom)
   ============================================================ */

function getGreetingKey(hour) {
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function initName() {
  const saved = localStorage.getItem(STORAGE_KEYS.name);
  if (saved) $("displayName").textContent = saved;
}

function promptForName() {
  const current = $("displayName").textContent;
  const name = prompt("Siapa nama Anda?", current === "Teman" ? "" : current);
  if (name === null) return; // user menekan Cancel
  const clean = name.trim().slice(0, 40);
  if (!clean) {
    localStorage.removeItem(STORAGE_KEYS.name);
    $("displayName").textContent = "Teman";
    return;
  }
  localStorage.setItem(STORAGE_KEYS.name, clean);
  $("displayName").textContent = clean;
}

function startClock() {
  const timeEl = $("clockTime");
  const dateEl = $("clockDate");
  const greetingEl = $("greetingLine");

  function tick() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateEl.textContent = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    greetingEl.textContent = getGreetingKey(now.getHours());
  }

  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   Bagian 4: Focus Timer Widget
   ============================================================ */

const FOCUS_DURATION = 25 * 60; // 25 menit dalam detik

const timer = {
  remaining: FOCUS_DURATION,
  intervalId: null,
};

function formatTimer(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderTimer() {
  $("timerDisplay").textContent = formatTimer(timer.remaining);
  const elapsed = FOCUS_DURATION - timer.remaining;
  $("timerProgressBar").style.width =
    (elapsed / FOCUS_DURATION) * 100 + "%";
}

function playDing() {
  // Notifikasi suara lembut lewat Web Audio API (tanpa file audio).
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + offset + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.35);
    });
  } catch {
    /* audio tidak tersedia — abaikan */
  }
}

function timerFinish() {
  stopTimer();
  timer.remaining = 0;
  renderTimer();
  playDing();
  alert("⏰ Waktu fokus 25 menit telah selesai. Saatnya istirahat sebentar!");
  timer.remaining = FOCUS_DURATION;
  renderTimer();
}

function startTimer() {
  if (timer.intervalId !== null) return;
  if (timer.remaining <= 0) timer.remaining = FOCUS_DURATION;
  $("timerStart").textContent = "Jalan...";
  $("timerStart").disabled = true;
  timer.intervalId = setInterval(() => {
    timer.remaining--;
    renderTimer();
    if (timer.remaining <= 0) timerFinish();
  }, 1000);
}

function stopTimer() {
  if (timer.intervalId !== null) {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
  $("timerStart").textContent = "Start";
  $("timerStart").disabled = false;
}

function resetTimer() {
  stopTimer();
  timer.remaining = FOCUS_DURATION;
  renderTimer();
}

/* ============================================================
   Bagian 5: To-Do List Widget
   ============================================================ */

let todos = loadJSON(STORAGE_KEYS.todos, []);
let todoMessageTimeout = null;

function saveTodos() {
  saveJSON(STORAGE_KEYS.todos, todos);
}

function showTodoMessage(text, isError) {
  const el = $("todoMessage");
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
  el.classList.add("show");
  clearTimeout(todoMessageTimeout);
  todoMessageTimeout = setTimeout(() => el.classList.remove("show"), 2500);
}

function renderTodos() {
  const list = $("todoList");
  const empty = $("todoEmpty");
  list.innerHTML = "";

  if (todos.length === 0) {
    empty.style.display = "block";
  } else {
    empty.style.display = "none";
  }

  todos.forEach((todo) => {
    const li = document.createElement("li");
    li.className = "todo-item" + (todo.done ? " done" : "");
    li.dataset.id = todo.id;

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo-check";
    check.checked = todo.done;
    check.addEventListener("change", () => toggleTodo(todo.id));

    const span = document.createElement("span");
    span.className = "todo-text";
    span.textContent = todo.text;
    span.title = "Klik dua kali untuk mengedit";
    span.addEventListener("dblclick", () => startEditTodo(todo.id));

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.title = "Edit tugas";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", () => startEditTodo(todo.id));

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn";
    delBtn.title = "Hapus tugas";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", () => deleteTodo(todo.id));

    li.append(check, span, editBtn, delBtn);
    list.appendChild(li);
  });

  const doneCount = todos.filter((t) => t.done).length;
  $("todoStats").textContent = `${todos.length} tugas · ${doneCount} selesai`;
}

function addTodo(text) {
  const clean = text.trim();
  if (!clean) return;

  // Prevent Duplicate Tasks (case-insensitive)
  const isDuplicate = todos.some(
    (t) => t.text.toLowerCase() === clean.toLowerCase()
  );
  if (isDuplicate) {
    showTodoMessage("Tugas itu sudah ada di daftar Anda.", true);
    return;
  }

  todos.unshift({ id: Date.now() + "-" + Math.random().toString(36).slice(2, 7), text: clean, done: false });
  saveTodos();
  renderTodos();
  $("todoInput").value = "";
  showTodoMessage("Tugas ditambahkan.", false);
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    saveTodos();
    renderTodos();
  }
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  renderTodos();
}

function startEditTodo(id) {
  const li = document.querySelector(`.todo-item[data-id="${id}"]`);
  if (!li || li.querySelector(".todo-edit-input")) return;
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  const span = li.querySelector(".todo-text");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.value = todo.text;
  input.maxLength = 120;
  span.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const clean = input.value.trim();
    if (clean && clean.toLowerCase() !== todo.text.toLowerCase()) {
      const dup = todos.some(
        (t) => t.id !== id && t.text.toLowerCase() === clean.toLowerCase()
      );
      if (dup) {
        showTodoMessage("Nama tugas itu sudah dipakai tugas lain.", true);
        renderTodos();
        return;
      }
      todo.text = clean;
    }
    saveTodos();
    renderTodos();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") renderTodos();
  });
  input.addEventListener("blur", commit);
}

/* ============================================================
   Bagian 6: Quick Links Widget
   ============================================================ */

let links = loadJSON(STORAGE_KEYS.links, null);
if (!Array.isArray(links)) {
  links = DEFAULT_LINKS; // default saat Local Storage masih kosong
  saveJSON(STORAGE_KEYS.links, links);
}

let linkMessageTimeout = null;

function saveLinks() {
  saveJSON(STORAGE_KEYS.links, links);
}

function showLinkMessage(text, isError) {
  const el = $("linkMessage");
  el.textContent = text;
  el.classList.toggle("error", Boolean(isError));
  el.classList.add("show");
  clearTimeout(linkMessageTimeout);
  linkMessageTimeout = setTimeout(() => el.classList.remove("show"), 2500);
}

function normalizeURL(url) {
  const clean = url.trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  return "https://" + clean;
}

function getFaviconURL(pageURL) {
  try {
    const domain = new URL(pageURL).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
  } catch {
    return "";
  }
}

function renderLinks() {
  const grid = $("linkGrid");
  grid.innerHTML = "";

  links.forEach((link, index) => {
    const a = document.createElement("a");
    a.className = "link-tile";
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.title = link.url;

    if (link.url) {
      const img = document.createElement("img");
      img.className = "link-favicon";
      img.src = getFaviconURL(link.url);
      img.alt = "";
      img.onerror = () => (img.style.visibility = "hidden");
      a.appendChild(img);
    }

    const name = document.createElement("span");
    name.className = "link-name";
    name.textContent = link.name || link.url;
    a.appendChild(name);

    const del = document.createElement("button");
    del.className = "link-delete";
    del.textContent = "✕";
    del.title = "Hapus link";
    del.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      links.splice(index, 1);
      saveLinks();
      renderLinks();
    });

    a.appendChild(del);
    grid.appendChild(a);
  });
}

function addLink(name, url) {
  const cleanName = name.trim();
  const finalURL = normalizeURL(url);
  if (!cleanName || !finalURL) {
    showLinkMessage("Isi nama dan URL-nya dulu ya.", true);
    return;
  }

  const dup = links.some((l) => l.url.toLowerCase() === finalURL.toLowerCase());
  if (dup) {
    showLinkMessage("Link itu sudah ada.", true);
    return;
  }

  links.push({ name: cleanName, url: finalURL });
  saveLinks();
  renderLinks();
  $("linkName").value = "";
  $("linkUrl").value = "";
  showLinkMessage("Link ditambahkan.", false);
}

/* ============================================================
   Bagian 7: Event Binding & Init
   ============================================================ */

function init() {
  // Tema
  initTheme();
  $("themeToggle").addEventListener("click", toggleTheme);

  // Greeting
  initName();
  $("editNameBtn").addEventListener("click", promptForName);
  startClock();

  // Timer
  renderTimer();
  $("timerStart").addEventListener("click", startTimer);
  $("timerStop").addEventListener("click", stopTimer);
  $("timerReset").addEventListener("click", resetTimer);

  // To-Do
  renderTodos();
  $("todoForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addTodo($("todoInput").value);
  });
  $("clearDone").addEventListener("click", () => {
    todos = todos.filter((t) => !t.done);
    saveTodos();
    renderTodos();
  });

  // Quick Links
  renderLinks();
  $("linkForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addLink($("linkName").value, $("linkUrl").value);
  });
}

document.addEventListener("DOMContentLoaded", init);
