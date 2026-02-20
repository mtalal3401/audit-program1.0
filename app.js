// app.js (module) — Dashboard + Auth (WORKING with your dashboard UI)

import { createClient as supabaseCreateClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =============================
// SUPABASE CONFIG (YOUR KEYS)
// =============================
const SUPABASE_URL = "https://syfnepulwwzwcfwjruwn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Zm5lcHVsd3d6d2Nmd2pydXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ4MjAsImV4cCI6MjA4Njk4MDgyMH0.JhjdCtj-ezy9tsA4kz1QmR3mk71kVyucs8v7OlcGEIk";

export const sb = supabaseCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: window.localStorage
  }
});

// =============================
// Helpers
// =============================
const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const x = document.createElement(tag); if (cls) x.className = cls; return x; };

function fmtDateDDMMMYYYY(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = d.toLocaleString("en", { month: "short" }).toUpperCase();
  const yyyy = d.getFullYear();
  return `${dd}/${mmm}/${yyyy}`;
}

function showModal(id, on) {
  const m = $(id);
  if (!m) return;
  m.classList.toggle("show", !!on);
}

function showApp(on) {
  const shell = $("appShell");
  const login = $("loginModal");
  if (shell) {
    shell.classList.toggle("hidden", !on);
    shell.setAttribute("aria-hidden", on ? "false" : "true");
  }
  if (login) login.classList.toggle("show", !on);
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $("panelClients")?.classList.toggle("hidden", tab !== "clients");
  $("panelEngagements")?.classList.toggle("hidden", tab !== "engagements");
}

// =============================
// Auth
// =============================
async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data?.session) throw new Error("Login succeeded but no session returned.");
  return data.session;
}

async function logout() {
  await sb.auth.signOut();
  location.href = "index.html";
}

async function getMyProfile() {
  const { data, error } = await sb.from("profiles").select("id, email, full_name, role").maybeSingle();
  if (error) throw error;
  return data;
}

function setPills(profile) {
  const u = profile?.email || "—";
  const r = profile?.role || "Staff";
  if ($("pillUser")) $("pillUser").textContent = `User: ${u}`;
  if ($("pillRole")) $("pillRole").textContent = `Role: ${r}`;
}

// =============================
// Data renderers
// =============================
function renderClientRow(c) {
  const row = el("div", "listitem");
  const left = el("div");
  const t = el("div", "ltitle"); t.textContent = c.name;
  const m = el("div", "lmeta"); m.textContent = `Engagements: ${c.engagement_count ?? 0}`;
  left.append(t, m);

  const right = el("div", "lactions");
  const open = el("button", "ghost"); open.textContent = "Open";
  open.onclick = () => openClient(c);
  right.append(open);

  row.append(left, right);
  return row;
}

function renderEngRow(e) {
  const row = el("div", "listitem");
  const left = el("div");
  const t = el("div", "ltitle"); t.textContent = e.name || `Engagement — ${fmtDateDDMMMYYYY(e.year_end)}`;
  const m = el("div", "lmeta"); m.textContent = `Year end: ${fmtDateDDMMMYYYY(e.year_end)}`;
  left.append(t, m);

  const right = el("div", "lactions");
  const fs = el("a", "ghost");
  fs.textContent = "Financial Statements";
  fs.href = `financial-statements.html?engagement_id=${encodeURIComponent(e.id)}`;

  const ap = el("a", "primary");
  ap.textContent = "Audit Program";
  ap.href = `audit-program.html?engagement_id=${encodeURIComponent(e.id)}`;

  right.append(fs, ap);
  row.append(left, right);
  return row;
}

// =============================
// State
// =============================
let cachedClients = [];
let currentClient = null;

// =============================
// Loading (Clients/Engagements)
// =============================

// IMPORTANT:
// Your original SQL RPC "get_my_clients" returns only clients where you are a member of an engagement.
// If you create a brand new client but haven't created an engagement yet, it may not show.
// So we load clients in TWO ways:
//  1) direct select clients you created (created_by = you)
//  2) plus RPC clients you are member of (if RPC exists)
async function loadClients() {
  const { data: userRes } = await sb.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not logged in.");

  // (A) Clients created by me
  const created = await sb.from("clients").select("id,name,created_at").eq("created_by", uid);
  if (created.error) throw created.error;

  // (B) Clients from RPC (membership-based) — if function exists
  let memberClients = [];
  const rpc = await sb.rpc("get_my_clients");
  if (!rpc.error) memberClients = rpc.data || [];

  // Merge by id
  const map = new Map();
  (memberClients || []).forEach(c => map.set(c.id, c));
  (created.data || []).forEach(c => {
    if (!map.has(c.id)) map.set(c.id, { id: c.id, name: c.name, engagement_count: 0 });
  });

  cachedClients = Array.from(map.values()).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  paintClientList();
  fillClientDropdown();
}

function paintClientList() {
  const q = ($("qClient")?.value || "").toLowerCase().trim();
  const box = $("clientList");
  if (!box) return;
  box.innerHTML = "";

  (cachedClients || [])
    .filter(c => !q || (c.name || "").toLowerCase().includes(q))
    .forEach(c => box.append(renderClientRow(c)));

  if (!cachedClients?.length) {
    const empty = el("div", "emptyState");
    empty.textContent = "No clients yet. Create one using “+ New Client”.";
    box.append(empty);
  }
}

function fillClientDropdown() {
  const sel = $("engClient");
  if (!sel) return;
  sel.innerHTML = "";
  (cachedClients || []).forEach(c => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.append(o);
  });
}

async function openClient(c) {
  currentClient = c;
  if ($("selClientName")) $("selClientName").value = c.name || "";
  setActiveTab("engagements");
  await loadEngagements(c.id);
}

async function loadEngagements(clientId) {
  const { data, error } = await sb
    .from("engagements")
    .select("id, client_id, name, year_end, created_at")
    .eq("client_id", clientId)
    .order("year_end", { ascending: false });

  if (error) throw error;

  const list = $("engList");
  if (!list) return;
  list.innerHTML = "";
  (data || []).forEach(e => list.append(renderEngRow(e)));

  if (!(data || []).length) {
    const empty = el("div", "emptyState");
    empty.textContent = "No engagements for this client yet. Click “+ New Engagement”.";
    list.append(empty);
  }
}

// =============================
// Inserts (RLS-safe)
// =============================
async function createClientRecord(name) {
  const { data: userRes } = await sb.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not authenticated. Logout/login again.");

  const { data, error } = await sb.from("clients")
    .insert({ name, created_by: uid })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

async function createEngagementRecord(client_id, name, year_end) {
  const { data: userRes } = await sb.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) throw new Error("Not authenticated. Logout/login again.");

  const { data, error } = await sb.from("engagements")
    .insert({ client_id, name, year_end, created_by: uid })
    .select("id, client_id, name, year_end")
    .single();

  if (error) throw error;
  return data;
}

// =============================
// Realtime (optional refresh)
// =============================
function wireRealtime() {
  const ch = sb.channel("dash-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => loadClients().catch(() => {}))
    .on("postgres_changes", { event: "*", schema: "public", table: "engagements" }, () => loadClients().catch(() => {}))
    .on("postgres_changes", { event: "*", schema: "public", table: "engagement_members" }, () => loadClients().catch(() => {}))
    .subscribe();
  return ch;
}

// =============================
// Boot
// =============================
async function bootAuthed() {
  showApp(true);

  const profile = await getMyProfile().catch(() => null);
  setPills(profile);

  await loadClients();
  setActiveTab("clients");
  wireRealtime();
}

async function init() {
  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  // Search
  $("qClient")?.addEventListener("input", paintClientList);

  // Login
  $("btnLogin")?.addEventListener("click", async () => {
    $("loginError").textContent = "";
    const email = $("loginUser").value.trim();
    const pass = $("loginPass").value;

    try {
      await login(email, pass);
      await bootAuthed();
    } catch (e) {
      $("loginError").textContent = e?.message || "Login failed";
    }
  });

  // Logout
  $("btnLogout")?.addEventListener("click", logout);

  // Modals: New Client
  $("btnNewClient")?.addEventListener("click", () => {
    $("clientErr").textContent = "";
    $("newClientName").value = "";
    showModal("clientModal", true);
  });
  $("closeClientModal")?.addEventListener("click", () => showModal("clientModal", false));
  $("btnCancelClient")?.addEventListener("click", () => showModal("clientModal", false));

  $("btnCreateClient")?.addEventListener("click", async () => {
    $("clientErr").textContent = "";
    const name = $("newClientName").value.trim();
    if (!name) { $("clientErr").textContent = "Client name required"; return; }

    try {
      await createClientRecord(name);
      showModal("clientModal", false);
      await loadClients();
    } catch (e) {
      $("clientErr").textContent = e?.message || "Failed to create client";
    }
  });

  // Modals: New Engagement
  $("btnNewEng")?.addEventListener("click", async () => {
    $("engErr").textContent = "";
    await loadClients(); // refresh dropdown options
    showModal("engModal", true);
  });
  $("closeEngModal")?.addEventListener("click", () => showModal("engModal", false));
  $("btnCancelEng")?.addEventListener("click", () => showModal("engModal", false));

  $("btnCreateEng")?.addEventListener("click", async () => {
    $("engErr").textContent = "";
    const client_id = $("engClient").value;
    const year_end = $("engYearEnd").value.trim();
    const name = $("engName").value.trim() || null;

    if (!client_id) { $("engErr").textContent = "Select client"; return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(year_end)) { $("engErr").textContent = "Year end must be YYYY-MM-DD"; return; }

    try {
      const eng = await createEngagementRecord(client_id, name, year_end);
      showModal("engModal", false);
      await loadClients();

      // open that client's engagements view
      const c = cachedClients.find(x => x.id === client_id);
      if (c) await openClient(c);

      // OPTIONAL: If your DB auto-adds creator to engagement_members via trigger, great.
      // If not, you'll need to add the member row too (we can do that next if required).
      console.log("Created engagement:", eng);
    } catch (e) {
      $("engErr").textContent = e?.message || "Failed to create engagement";
    }
  });

  // Back
  $("btnBackClients")?.addEventListener("click", () => setActiveTab("clients"));

  // Session check on load
  const { data } = await sb.auth.getSession();
  if (data?.session) {
    await bootAuthed();
  } else {
    showApp(false);
  }
}

init();
