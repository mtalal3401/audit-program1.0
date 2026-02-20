// app.js (module) — Dashboard + Auth
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/**
 * 1) Put your project URL + anon key here.
 * 2) Make sure Auth (email/password) is enabled in Supabase.
 */
const SUPABASE_URL = "https://syfnepulwwzwcfwjruwn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Zm5lcHVsd3d6d2Nmd2pydXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ4MjAsImV4cCI6MjA4Njk4MDgyMH0.JhjdCtj-ezy9tsA4kz1QmR3mk71kVyucs8v7OlcGEIk";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: window.localStorage,
  }
});

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const x=document.createElement(tag); if(cls) x.className=cls; return x; };

function qs(name){
  const u=new URL(location.href);
  return u.searchParams.get(name);
}

function showModal(id, on){
  const m=$(id);
  if(!m) return;
  m.classList.toggle("show", !!on);
}

function showApp(on){
  const shell = $("appShell");
  const login = $("loginModal");
  shell?.classList.toggle("hidden", !on);
  shell?.setAttribute("aria-hidden", on ? "false" : "true");
  login?.classList.toggle("show", !on);
}

async function safe(fn){
  try{ return await fn(); } catch(e){ console.error(e); throw e; }
}

async function getMyProfile(){
  const { data, error } = await sb.from("profiles").select("id, email, full_name, role").maybeSingle();
  if(error) throw error;
  return data;
}

async function login(email, password){
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if(error) throw error;
  return data;
}

async function logout(){
  await sb.auth.signOut();
  location.href = "index.html";
}

function setPills(profile){
  const u = profile?.email || "—";
  const r = profile?.role || "Staff";
  $("pillUser") && ($("pillUser").textContent = `User: ${u}`);
  $("pillRole") && ($("pillRole").textContent = `Role: ${r}`);
}

function setActiveTab(tab){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===tab));
  $("panelClients")?.classList.toggle("hidden", tab!=="clients");
  $("panelEngagements")?.classList.toggle("hidden", tab!=="engagements");
}

function renderClientRow(c){
  const row = el("div","listitem");
  const left = el("div");
  const t = el("div","ltitle"); t.textContent = c.name;
  const m = el("div","lmeta"); m.textContent = `Engagements: ${c.engagement_count || 0}`;
  left.append(t,m);

  const right = el("div","lactions");
  const open = el("button","ghost"); open.textContent="Open";
  open.onclick=()=> openClient(c);
  right.append(open);

  row.append(left,right);
  return row;
}

function renderEngRow(e){
  const row = el("div","listitem");
  const left = el("div");
  const t = el("div","ltitle"); t.textContent = e.name || `Engagement — ${e.year_end || ""}`;
  const m = el("div","lmeta"); m.textContent = `Year end: ${e.year_end || "—"}`;
  left.append(t,m);

  const right = el("div","lactions");
  const fs = el("a","ghost"); fs.textContent="Financial Statements"; fs.href = `financial-statements.html?engagement_id=${encodeURIComponent(e.id)}`;
  const ap = el("a","primary"); ap.textContent="Audit Program"; ap.href = `audit-program.html?engagement_id=${encodeURIComponent(e.id)}`;
  right.append(fs, ap);

  row.append(left,right);
  return row;
}

let cachedClients = [];
let currentClient = null;

async function loadClients(){
  /**
   * Clients visible to the logged-in user:
   * - user is member of at least one engagement under that client
   */
  const { data, error } = await sb.rpc("get_my_clients");
  if(error) throw error;

  cachedClients = data || [];
  paintClientList();
  fillClientDropdown();
}

function paintClientList(){
  const q = ($("qClient")?.value || "").toLowerCase().trim();
  const box = $("clientList");
  if(!box) return;
  box.innerHTML = "";

  (cachedClients || [])
    .filter(c => !q || (c.name || "").toLowerCase().includes(q))
    .forEach(c => box.append(renderClientRow(c)));

  if(!cachedClients?.length){
    const empty = el("div","emptyState");
    empty.textContent="No clients yet. Create one using “+ New Client”.";
    box.append(empty);
  }
}

function fillClientDropdown(){
  const sel = $("engClient");
  if(!sel) return;
  sel.innerHTML = "";
  (cachedClients || []).forEach(c=>{
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    sel.append(o);
  });
}

async function openClient(c){
  currentClient = c;
  $("selClientName").value = c.name || "";
  setActiveTab("engagements");
  await loadEngagements(c.id);
}

async function loadEngagements(clientId){
  const { data, error } = await sb
    .from("engagements")
    .select("id, client_id, name, year_end, created_at")
    .eq("client_id", clientId)
    .order("year_end", { ascending:false });
  if(error) throw error;

  const list = $("engList");
  list.innerHTML="";
  (data||[]).forEach(e => list.append(renderEngRow(e)));

  if(!(data||[]).length){
    const empty = el("div","emptyState");
    empty.textContent="No engagements for this client yet. Click “+ New Engagement”.";
    list.append(empty);
  }
}

// ---- Modals: create client + engagement ----
async function createClient(name){
  const { data, error } = await sb.from("clients").insert({ name }).select("id,name").single();
  if(error) throw error;
  return data;
}

async function createEngagement(client_id, name, year_end){
  const { data, error } = await sb.from("engagements")
    .insert({ client_id, name, year_end })
    .select("id, client_id, name, year_end")
    .single();
  if(error) throw error;
  return data;
}

// ---- Realtime ----
function wireRealtime(){
  // When any client/engagement changes that affects this user, refresh clients list
  const ch = sb.channel("dash-realtime")
    .on("postgres_changes", { event:"*", schema:"public", table:"clients" }, () => loadClients())
    .on("postgres_changes", { event:"*", schema:"public", table:"engagements" }, () => loadClients())
    .on("postgres_changes", { event:"*", schema:"public", table:"engagement_members" }, () => loadClients())
    .subscribe();
  return ch;
}

// ---- Boot ----
async function init(){
  // Basic tab UI
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setActiveTab(btn.dataset.tab));
  });
  $("qClient")?.addEventListener("input", paintClientList);

  // Login
  $("btnLogin")?.addEventListener("click", async ()=>{
    $("loginError").textContent="";
    const email = $("loginUser").value.trim();
    const pass  = $("loginPass").value;
    try{
      await login(email, pass);
      await bootAuthed();
    }catch(e){
      $("loginError").textContent = e?.message || "Login failed";
    }
  });

  $("btnLogout")?.addEventListener("click", logout);

  // Modals open/close
  $("btnNewClient")?.addEventListener("click", ()=>{ $("clientErr").textContent=""; $("newClientName").value=""; showModal("clientModal", true); });
  $("closeClientModal")?.addEventListener("click", ()=> showModal("clientModal", false));
  $("btnCancelClient")?.addEventListener("click", ()=> showModal("clientModal", false));
  $("btnCreateClient")?.addEventListener("click", async ()=>{
    $("clientErr").textContent="";
    const name = $("newClientName").value.trim();
    if(!name){ $("clientErr").textContent="Client name required"; return; }
    try{
      await createClient(name);
      showModal("clientModal", false);
      await loadClients();
    }catch(e){ $("clientErr").textContent=e?.message||"Failed"; }
  });

  $("btnNewEng")?.addEventListener("click", async ()=>{
    $("engErr").textContent="";
    showModal("engModal", true);
  });
  $("closeEngModal")?.addEventListener("click", ()=> showModal("engModal", false));
  $("btnCancelEng")?.addEventListener("click", ()=> showModal("engModal", false));

  $("btnCreateEng")?.addEventListener("click", async ()=>{
    $("engErr").textContent="";
    const client_id = $("engClient").value;
    const year_end  = $("engYearEnd").value.trim();
    const name      = $("engName").value.trim() || null;
    if(!client_id){ $("engErr").textContent="Select client"; return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(year_end)){ $("engErr").textContent="Year end must be YYYY-MM-DD"; return; }
    try{
      const eng = await createEngagement(client_id, name, year_end);
      showModal("engModal", false);
      await loadClients();
      const c = cachedClients.find(x=>x.id===client_id);
      if(c) await openClient(c);
    }catch(e){ $("engErr").textContent=e?.message||"Failed"; }
  });

  $("btnBackClients")?.addEventListener("click", ()=> setActiveTab("clients"));

  // Session check
  const { data } = await sb.auth.getSession();
  if(data?.session){
    await bootAuthed();
  }else{
    showApp(false);
  }
}

async function bootAuthed(){
  showApp(true);
  const profile = await getMyProfile();
  setPills(profile);

  await loadClients();
  setActiveTab("clients");
  wireRealtime();
}

init();
