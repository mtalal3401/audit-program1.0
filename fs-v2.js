// fs-v2.js — Financial Statements (Professional Reporting Engine v2)

import { createClient as supabaseCreateClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

import {
  formatDateDDMMMYYYY,
  formatNumber,
  isMajorVariance,
} from "./formatters.js";

import {
  buildTrialBalance,
  buildStatement,
} from "./reporting-engine-v2.js";

// =============================
// SUPABASE CONFIG
// =============================
// NOTE: This is an ANON key. Still avoid committing other secrets.
const SUPABASE_URL = "https://syfnepulwwzwcfwjruwn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Zm5lcHVsd3d6d2Nmd2pydXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ4MjAsImV4cCI6MjA4Njk4MDgyMH0.JhjdCtj-ezy9tsA4kz1QmR3mk71kVyucs8v7OlcGEIk";

const sb = supabaseCreateClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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
const el = (tag, cls) => { const x=document.createElement(tag); if(cls) x.className=cls; return x; };

function q(name){
  const u=new URL(location.href);
  return u.searchParams.get(name);
}

const engagement_id = q("engagement_id");

function showModal(id, on){
  const m = $(id);
  if(!m) return;
  m.classList.toggle("show", !!on);
}

function setFSPage(page){
  document.querySelectorAll(".child[data-page]").forEach(x=>x.classList.toggle("active", x.dataset.page===page));
  ["upload","tb","sofp","sopl","cfs","lead"].forEach(p=>{
    $("page_"+p)?.classList.toggle("hidden", p!==page);
  });

  const titles = {
    upload: ["Uploads", "Upload COA + General Ledger (CSV)"],
    tb:     ["Trial Balance", "Professional TB with Adjustments + Comparative"],
    sofp:   ["Statement of Financial Position", "Comparatives + Variances (Assets = Liabilities + Equity)"],
    sopl:   ["Statement of Financial Performance", "Comparatives + Variances (with major variance highlighting)"],
    cfs:    ["Cash Flow (Indirect)", "Draft scaffold (extend to full indirect method)"],
    lead:   ["Lead Schedules", "Generate totals for each Audit Area (PPE, TD, CASH, etc.)"],
  };
  $("pageTitle").textContent = titles[page]?.[0] || "—";
  $("pageSub").textContent = titles[page]?.[1] || "—";
}

async function ensureSession(){
  const { data } = await sb.auth.getSession();
  if(!data?.session){
    // back to dashboard
    location.href = "index.html";
    throw new Error("No session");
  }
}

async function logout(){
  await sb.auth.signOut();
  location.href = "index.html";
}

async function loadEngagement(){
  const { data, error } = await sb
    .from("engagements")
    .select("id, name, year_end, client:clients(id,name)")
    .eq("id", engagement_id)
    .single();
  if(error) throw error;
  return data;
}

async function loadSiblingEngagements(clientId){
  const { data, error } = await sb
    .from("engagements")
    .select("id, year_end, name")
    .eq("client_id", clientId)
    .order("year_end", { ascending: false });
  if(error) throw error;
  return data || [];
}

function yearLabelFromYearEnd(yearEnd){
  if(!yearEnd) return "—";
  const y = new Date(yearEnd).getFullYear();
  return String(y);
}

function findPreviousYearEngagement(currentYearEnd, engagements){
  if(!currentYearEnd) return null;
  const d = new Date(currentYearEnd);
  if(Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() - 1);
  const target = d.toISOString().slice(0,10);
  return engagements.find(e => e.year_end === target) || null;
}

// ---------------- CSV helpers ----------------
function parseCSV(text){
  const rows=[];
  let i=0, field="", row=[], inQ=false;
  while(i<text.length){
    const c=text[i];
    if(inQ){
      if(c === '"' && text[i+1] === '"'){ field+='"'; i+=2; continue; }
      if(c === '"'){ inQ=false; i++; continue; }
      field+=c; i++; continue;
    }else{
      if(c === '"'){ inQ=true; i++; continue; }
      if(c === ','){ row.push(field); field=""; i++; continue; }
      if(c === '\n'){
        row.push(field); field="";
        if(row.length>1 || row[0]!=="" ) rows.push(row);
        row=[]; i++; continue;
      }
      if(c === '\r'){ i++; continue; }
      field+=c; i++; continue;
    }
  }
  row.push(field);
  if(row.length>1 || row[0]!=="" ) rows.push(row);
  if(!rows.length) return { header:[], data:[] };
  const header = rows[0].map(h=>String(h||"").trim());
  const data = rows.slice(1).filter(r=>r.some(x=>String(x||"").trim()!==""));
  return { header, data };
}

function toObjects(csv){
  const { header, data } = csv;
  return data.map(r=>{
    const o={};
    header.forEach((h,i)=>{
      const v=(r[i] ?? "").toString().trim();
      o[h]=v;
      o[h.toLowerCase()] = v;
    });
    return o;
  });
}

async function readFile(input){
  const f = input.files?.[0];
  if(!f) return null;
  return await f.text();
}

async function batchInsert(table, rows, chunk=500){
  for(let i=0;i<rows.length;i+=chunk){
    const part = rows.slice(i, i+chunk);
    const { error } = await sb.from(table).insert(part);
    if(error) throw error;
  }
}

async function clearEngagementData(){
  const { error } = await sb.rpc("clear_engagement_fs_data", { p_engagement_id: engagement_id });
  if(error) throw error;
}

async function uploadCOAandGL(){
  const coaText = await readFile($("coaFile"));
  const glText  = await readFile($("glFile"));
  if(!coaText || !glText) throw new Error("Please select both COA and GL CSV files.");

  $("uploadErr").textContent="";
  $("uploadHint").textContent="Parsing CSV…";

  const coaCsv = parseCSV(coaText);
  const coaRows = toObjects(coaCsv).map(r=>({
    engagement_id,
    account_code: (r.account_code || "").trim(),
    account_name: (r.account_name || "").trim(),
    normal_balance: (r.normal_balance || "").trim().toUpperCase() || null,
    statement: (r.statement || "").trim().toUpperCase() || null,
    section: (r.section || "").trim() || null,
    line_item: (r.line_item || "").trim() || null,
  })).filter(x=>x.account_code);

  const glCsv = parseCSV(glText);
  const glRows = toObjects(glCsv).map(r=>({
    engagement_id,
    txn_date: (r.txn_date || "").trim() || null,
    voucher_no: (r.voucher_no || "").trim() || null,
    account_code: (r.account_code || "").trim(),
    description: (r.description || "").trim() || null,
    debit: Number((r.debit || "0").toString().replace(/,/g,"")) || 0,
    credit: Number((r.credit || "0").toString().replace(/,/g,"")) || 0,
  })).filter(x=>x.account_code);

  if(!coaRows.length) throw new Error("COA file parsed but no rows found (check headers)." );
  if(!glRows.length) throw new Error("GL file parsed but no rows found (check headers)." );

  $("uploadHint").textContent=`Uploading COA (${coaRows.length})…`;
  await sb.rpc("replace_coa", { p_engagement_id: engagement_id });
  await batchInsert("coa_accounts", coaRows, 500);

  $("uploadHint").textContent=`Uploading GL (${glRows.length})…`;
  await sb.rpc("replace_gl", { p_engagement_id: engagement_id });
  await batchInsert("gl_entries", glRows, 1000);

  $("uploadHint").textContent="Done. Outputs updated.";
}

async function generateLeadSchedules(){
  const { error } = await sb.rpc("generate_lead_schedules", { p_engagement_id: engagement_id });
  if(error) throw error;
}

// =============================
// Rendering
// =============================

function makeToolbar({ idPrefix, years, defaultSelected, onChange }){
  const wrap = el("div","ls-toolbar");

  const left = el("div","ls-toolbar-left");
  const hint = el("div","ls-hint");
  hint.textContent = "Comparatives / view settings";
  left.append(hint);

  const right = el("div","ls-toolbar-right");

  // Years multi-select
  const sel = el("select","pillselect");
  sel.id = `${idPrefix}_years`;
  sel.multiple = true;
  sel.size = Math.min(5, Math.max(2, years.length));
  years.forEach(y=>{
    const o=document.createElement("option");
    o.value = y.id;
    o.textContent = `${yearLabelFromYearEnd(y.year_end)} (${formatDateDDMMMYYYY(y.year_end)})`;
    if(defaultSelected.includes(y.id)) o.selected = true;
    sel.append(o);
  });

  // Level dropdown
  const level = el("select","pillselect");
  level.id = `${idPrefix}_level`;
  [
    ["account","Accounts"],
    ["line_item","Line items"],
    ["section","Heads (Totals only)"]
  ].forEach(([v,t])=>{
    const o=document.createElement("option");
    o.value=v; o.textContent=t;
    level.append(o);
  });
  level.value = "line_item";

  // Adjustment prefixes
  const pref = el("input");
  pref.id = `${idPrefix}_adjpref`;
  pref.placeholder = "Adj prefixes: ADJ,JV";
  pref.value = "ADJ,JV,AJ";
  pref.className = "pillselect";
  pref.style.minWidth = "170px";

  // Variance threshold
  const thr = el("input");
  thr.id = `${idPrefix}_varthr`;
  thr.placeholder = "Major variance abs";
  thr.value = "500000";
  thr.className = "pillselect";
  thr.style.minWidth = "150px";

  const apply = el("button","ghost");
  apply.textContent = "Apply";
  apply.type = "button";
  apply.onclick = () => onChange();

  right.append(sel, level, pref, thr, apply);
  wrap.append(left, right);
  return wrap;
}

function renderTable({ container, columns, rows, rowClassFn }){
  container.innerHTML = "";
  const tbl = el("table","conclusion-table");
  const thead = el("thead");
  const trh = el("tr");
  for(const c of columns){
    const th=el("th"); th.textContent=c;
    trh.append(th);
  }
  thead.append(trh);
  const tbody = el("tbody");
  for(const r of rows){
    const tr=el("tr");
    const klass = rowClassFn ? rowClassFn(r) : "";
    if(klass) tr.className = klass;
    for(const v of r){
      const td=el("td");
      td.textContent = v;
      tr.append(td);
    }
    tbody.append(tr);
  }
  tbl.append(thead,tbody);
  container.append(tbl);
}

async function fetchCOA(engId){
  const { data, error } = await sb
    .from("coa_accounts")
    .select("account_code, account_name, normal_balance, statement, section, line_item")
    .eq("engagement_id", engId);
  if(error) throw error;
  return data || [];
}

async function fetchGL(engId){
  const { data, error } = await sb
    .from("gl_entries")
    .select("txn_date, voucher_no, account_code, description, debit, credit")
    .eq("engagement_id", engId);
  if(error) throw error;
  return data || [];
}

function getSelectedEngagementIds(selEl){
  return Array.from(selEl?.selectedOptions || []).map(o=>o.value);
}

function getAdjPrefixes(inputEl){
  const s = String(inputEl?.value || "").trim();
  if(!s) return ["ADJ","JV","AJ"];
  return s.split(",").map(x=>x.trim()).filter(Boolean);
}

function getVarAbsThreshold(inputEl){
  const n = Number(String(inputEl?.value || "").replace(/,/g,""));
  return Number.isFinite(n) ? n : 500000;
}

async function renderTBv2(toolbarPrefix){
  const yearsSel = $(`${toolbarPrefix}_years`);
  const levelSel = $(`${toolbarPrefix}_level`);
  const prefIn = $(`${toolbarPrefix}_adjpref`);

  const selected = getSelectedEngagementIds(yearsSel);
  if(!selected.length){
    $("tbOut").innerHTML = `<div class="emptyState">Select at least one year.</div>`;
    return;
  }

  // First selected = current year for display
  const currentEngId = selected[0];
  const compareIds = selected.slice(1);
  const prefixes = getAdjPrefixes(prefIn);

  const [coaCur, glCur] = await Promise.all([fetchCOA(currentEngId), fetchGL(currentEngId)]);
  const tbCur = buildTrialBalance({ coaRows: coaCur, glRows: glCur, adjustmentPrefixes: prefixes });

  // Build previous-year TB map for dr/cr columns
  let tbPrev = new Map();
  if(compareIds.length){
    // use first comparison as "previous" for TB PY columns
    const [coaPrev, glPrev] = await Promise.all([fetchCOA(compareIds[0]), fetchGL(compareIds[0])]);
    tbPrev = buildTrialBalance({ coaRows: coaPrev, glRows: glPrev, adjustmentPrefixes: prefixes });
  }

  const rows = [];
  const level = levelSel.value; // not used yet for TB (always account)
  void(level);

  const codes = Array.from(tbCur.keys()).sort((a,b)=>a.localeCompare(b));
  for(const code of codes){
    const r = tbCur.get(code);
    const py = tbPrev.get(code);
    rows.push([
      r.account_code,
      r.account_name,
      formatNumber(r.cy_dr),
      formatNumber(r.cy_cr),
      formatNumber(r.adj_dr),
      formatNumber(r.adj_cr),
      formatNumber(py?.cy_dr || 0),
      formatNumber(py?.cy_cr || 0),
    ]);
  }

  renderTable({
    container: $("tbOut"),
    columns: ["Account No.","Account Description","CY Dr","CY Cr","Adj Dr","Adj Cr","PY Dr","PY Cr"],
    rows,
  });
}

function pruneEmptySections(rows, yearKeys){
  // Remove rows whose entire section totals are zero across all years
  const secSum = new Map();
  for(const r of rows){
    const sec = r.section || "—";
    if(!secSum.has(sec)) secSum.set(sec, 0);
    for(const y of yearKeys){
      secSum.set(sec, secSum.get(sec) + Math.abs(Number(r.years?.[y] || 0)));
    }
  }
  return rows.filter(r => (secSum.get(r.section || "—") || 0) !== 0);
}

async function renderStatementV2({ toolbarPrefix, statementName, outId }){
  const yearsSel = $(`${toolbarPrefix}_years`);
  const levelSel = $(`${toolbarPrefix}_level`);
  const prefIn = $(`${toolbarPrefix}_adjpref`);
  const thrIn  = $(`${toolbarPrefix}_varthr`);

  const selected = getSelectedEngagementIds(yearsSel);
  if(!selected.length){
    $(outId).innerHTML = `<div class="emptyState">Select at least one year.</div>`;
    return;
  }

  const prefixes = getAdjPrefixes(prefIn);
  const absThr = getVarAbsThreshold(thrIn);
  const level = levelSel.value; // account | line_item | section
  const normalizeLevel = level === "line_item" ? "line_item" : level;

  // Pull all selected years data
  const yearMeta = [];
  for(const id of selected){
    const [coa, gl] = await Promise.all([fetchCOA(id), fetchGL(id)]);
    const tb = buildTrialBalance({ coaRows: coa, glRows: gl, adjustmentPrefixes: prefixes });
    const rows = buildStatement({ tbMap: tb, statementName, level: normalizeLevel });
    yearMeta.push({ engagement_id: id, rows, yearLabel: null });
  }

  // Build year labels (use year_end from engagement list already in DOM options text -> safer to fetch)
  const optMap = new Map(Array.from(yearsSel.options).map(o=>[o.value, o.textContent]));
  yearMeta.forEach(x=>{
    const t = optMap.get(x.engagement_id) || "";
    // label is first token (yyyy)
    const lbl = (t.match(/^\d{4}/)?.[0]) || x.engagement_id.slice(0,4);
    x.yearLabel = lbl;
  });

  const yearKeys = yearMeta.map(x=>x.yearLabel);
  const base = yearMeta[0];

  // Merge into a single map by identity
  const keyOf = (r)=> `${r.section}||${r.line_item}||${r.account_code||""}||${r.account_name||""}`;
  const map = new Map();
  for(const r of base.rows){
    map.set(keyOf(r), { ...r, years: { [base.yearLabel]: Number(r.amount||0) } });
  }
  for(const yr of yearMeta.slice(1)){
    for(const r of yr.rows){
      const k = keyOf(r);
      if(!map.has(k)) map.set(k, { ...r, years: { [base.yearLabel]: 0 } });
      map.get(k).years[yr.yearLabel] = Number(r.amount||0);
    }
  }

  let merged = Array.from(map.values());
  merged.sort((a,b)=>{
    const sa = String(a.section||"");
    const sb = String(b.section||"");
    if(sa !== sb) return sa.localeCompare(sb);
    const la = String(a.line_item||"");
    const lb = String(b.line_item||"");
    if(la !== lb) return la.localeCompare(lb);
    return String(a.account_code||"").localeCompare(String(b.account_code||""));
  });

  // Hide empty sections
  merged = pruneEmptySections(merged, yearKeys);

  // Variance columns: use first two years only (CY vs PY)
  const yearA = yearKeys[0];
  const yearB = yearKeys[1] || null;

  const columns = ["Head", "Subhead"].concat(yearKeys.map(y=>y));
  if(yearB) columns.push("Variance");

  const rows = merged.map(r=>{
    const head = r.section || "—";
    const sub = (normalizeLevel === "section") ? "" : (r.line_item || r.account_name || "—");
    const vals = yearKeys.map(y=> formatNumber(r.years?.[y] || 0));
    const baseVal = Number(r.years?.[yearB] || 0);
    const varAmt = yearB ? (Number(r.years?.[yearA] || 0) - baseVal) : 0;
    const out = [head, sub, ...vals];
    if(yearB) out.push(formatNumber(varAmt));
    return { out, head, varAmt, yearAVal: Number(r.years?.[yearA]||0), yearBVal: baseVal };
  });

  renderTable({
    container: $(outId),
    columns,
    rows: rows.map(x=>x.out),
    rowClassFn: (r) => {
      // r is array of values - we need matching via index; easiest: no
      return "";
    }
  });

  // Add major variance highlighting by post-processing
  if(yearB){
    const tbl = $(outId).querySelector("table");
    if(tbl){
      const bodyRows = tbl.querySelectorAll("tbody tr");
      bodyRows.forEach((tr, idx)=>{
        const meta = rows[idx];
        if(isMajorVariance(meta.yearAVal, meta.yearBVal, 0.25, absThr)){
          tr.classList.add("major-var-row");
        }
      });
    }
  }
}

// =============================
// Realtime badge
// =============================
function wireFSRealtime(){
  const badge = $("syncState");
  const set = (t)=>{ if(badge) badge.textContent=t; };
  const ch = sb.channel(`fs2-${engagement_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"gl_entries", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (GL)"))
    .on("postgres_changes", { event:"*", schema:"public", table:"coa_accounts", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (COA)"))
    .on("postgres_changes", { event:"*", schema:"public", table:"lead_schedules", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (Lead)"))
    .subscribe();
  set("Connected");
  return ch;
}

// =============================
// Boot
// =============================
async function boot(){
  await ensureSession();
  if(!engagement_id){ location.href = "index.html"; return; }

  $("btnLogout")?.addEventListener("click", logout);

  const eng = await loadEngagement();
  $("pillEng").textContent = `${eng.client?.name || ""} — ${eng.name || "Engagement"} (${formatDateDDMMMYYYY(eng.year_end) || "—"})`;

  // Link to audit page with same engagement_id
  const toAudit = $("btnToAudit");
  if(toAudit) toAudit.href = `audit-program.html?engagement_id=${encodeURIComponent(engagement_id)}`;

  // Side nav
  document.querySelectorAll(".child[data-page]").forEach(x=>{
    x.addEventListener("click", async ()=>{
      const p=x.dataset.page;
      setFSPage(p);
      try{
        if(p==="tb") await renderTBv2("tb");
        if(p==="sofp") await renderStatementV2({ toolbarPrefix:"sofp", statementName:"SOFP", outId:"sofpOut" });
        if(p==="sopl") await renderStatementV2({ toolbarPrefix:"sopl", statementName:"SOPL", outId:"soplOut" });
        if(p==="cfs") $("page_cfs").innerHTML = `<div class="emptyState">Cash Flow scaffold not implemented yet. Extend by mapping COA to operating/investing/financing and computing indirect adjustments.</div>`;
      }catch(e){
        console.error(e);
      }
    });
  });

  $("btnUpload")?.addEventListener("click", async ()=>{
    $("uploadErr").textContent="";
    try{
      await uploadCOAandGL();
    }catch(e){
      $("uploadErr").textContent = e?.message || "Upload failed";
    }
  });

  $("btnClearData")?.addEventListener("click", async ()=>{
    $("uploadErr").textContent="";
    $("uploadHint").textContent="Clearing…";
    try{
      await clearEngagementData();
      $("uploadHint").textContent="Cleared.";
    }catch(e){
      $("uploadErr").textContent = e?.message || "Failed";
      $("uploadHint").textContent="—";
    }
  });

  $("btnGenLead")?.addEventListener("click", async ()=>{
    $("leadErr").textContent="";
    $("leadHint").textContent="Generating…";
    try{
      await generateLeadSchedules();
      $("leadHint").textContent="Lead schedules generated. Open Audit Program → Lead Schedule tab.";
    }catch(e){
      $("leadErr").textContent = e?.message || "Failed";
      $("leadHint").textContent="—";
    }
  });

  // Build toolbars (years + view settings)
  const siblings = await loadSiblingEngagements(eng.client?.id);
  const prev = findPreviousYearEngagement(eng.year_end, siblings);
  const defaultSelected = [engagement_id].concat(prev ? [prev.id] : []);

  // TB toolbar
  $("tbToolbar").append(
    makeToolbar({
      idPrefix:"tb",
      years: siblings,
      defaultSelected,
      onChange: ()=> renderTBv2("tb")
    })
  );

  // SOFP toolbar
  $("sofpToolbar").append(
    makeToolbar({
      idPrefix:"sofp",
      years: siblings,
      defaultSelected,
      onChange: ()=> renderStatementV2({ toolbarPrefix:"sofp", statementName:"SOFP", outId:"sofpOut" })
    })
  );

  // SOPL toolbar
  $("soplToolbar").append(
    makeToolbar({
      idPrefix:"sopl",
      years: siblings,
      defaultSelected,
      onChange: ()=> renderStatementV2({ toolbarPrefix:"sopl", statementName:"SOPL", outId:"soplOut" })
    })
  );

  // default page
  wireFSRealtime();
  setFSPage("upload");
}

boot();
