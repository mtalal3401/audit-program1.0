// engagement.js (module) — Financial Statements + Audit Program pages (linked)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// Keep identical config to app.js
const SUPABASE_URL = "https://syfnepulwwzwcfwjruwn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Zm5lcHVsd3d6d2Nmd2pydXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ4MjAsImV4cCI6MjA4Njk4MDgyMH0.JhjdCtj-ezy9tsA4kz1QmR3mk71kVyucs8v7OlcGEIk";
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => { const x=document.createElement(tag); if(cls) x.className=cls; return x; };

function q(name){
  const u=new URL(location.href);
  return u.searchParams.get(name);
}
const engagement_id = q("engagement_id");

function fmt(n){
  const x = Number(n||0);
  return x.toLocaleString(undefined,{maximumFractionDigits:0});
}

async function logout(){
  await sb.auth.signOut();
  location.href = "dashboard.html";
}

async function ensureSession(){
  const { data } = await sb.auth.getSession();
  if(!data?.session){
    location.href = "dashboard.html";
    throw new Error("No session");
  }
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

/* ---------------- CSV helpers (simple, robust for typical exports) ---------------- */
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
  const idx = {};
  header.forEach((h,i)=> idx[h.toLowerCase()] = i);
  return data.map(r=>{
    const o={};
    header.forEach((h,i)=> o[h]= (r[i] ?? "").toString().trim());
    // also add lower-case keys
    header.forEach((h,i)=> o[h.toLowerCase()] = (r[i] ?? "").toString().trim());
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

/* ---------------- Financial Statements page ---------------- */
function isFSPage(){
  return !!$("page_upload");
}

function setFSPage(page){
  document.querySelectorAll(".child[data-page]").forEach(x=>x.classList.toggle("active", x.dataset.page===page));
  ["upload","tb","sofp","sopl","cfs","lead"].forEach(p=>{
    $("page_"+p)?.classList.toggle("hidden", p!==page);
  });

  const titles = {
    upload: ["Uploads", "Upload COA + General Ledger (CSV)"],
    tb:     ["Trial Balance", "Auto-generated from General Ledger"],
    sofp:   ["Statement of Financial Position", "Auto-generated from COA mapping"],
    sopl:   ["Statement of Financial Performance", "Auto-generated from COA mapping"],
    cfs:    ["Cash Flow (Indirect)", "Draft scaffold (you can extend to full indirect method)"],
    lead:   ["Lead Schedules", "Generate totals for each Audit Area (PPE, TD, CASH, etc.)"]
  };
  $("pageTitle").textContent = titles[page][0];
  $("pageSub").textContent = titles[page][1];
}

function tableHTML(cols, rows){
  const wrap = el("div");
  const tbl = el("table","conclusion-table");
  const thead = el("thead");
  const trh = el("tr");
  cols.forEach(c=>{ const th=el("th"); th.textContent=c; trh.append(th); });
  thead.append(trh);
  const tbody = el("tbody");
  rows.forEach(r=>{
    const tr=el("tr");
    r.forEach(v=>{ const td=el("td"); td.textContent=v; tr.append(td); });
    tbody.append(tr);
  });
  tbl.append(thead,tbody);
  wrap.append(tbl);
  return wrap;
}

async function renderTB(){
  const box = $("page_tb");
  box.innerHTML="";
  const { data, error } = await sb
    .from("trial_balance_v")
    .select("account_code, account_name, dr, cr, net")
    .eq("engagement_id", engagement_id)
    .order("account_code");
  if(error) throw error;

  const rows = (data||[]).map(x=>[
    x.account_code,
    x.account_name || "",
    fmt(x.dr),
    fmt(x.cr),
    fmt(x.net),
  ]);
  box.append(tableHTML(["Account","Name","Debit","Credit","Net"], rows));
}

async function renderStatement(viewName, boxId, titleDebit="Amount"){
  const box = $(boxId);
  box.innerHTML="";
  const { data, error } = await sb
    .from(viewName)
    .select("section, line_item, amount")
    .eq("engagement_id", engagement_id)
    .order("section")
    .order("line_item");
  if(error) throw error;

  const rows = (data||[]).map(x=>[x.section||"—", x.line_item||"—", fmt(x.amount)]);
  box.append(tableHTML(["Section","Line item", titleDebit], rows));
}

async function clearEngagementData(){
  // Server-side function handles deletes (safer with RLS)
  const { error } = await sb.rpc("clear_engagement_fs_data", { p_engagement_id: engagement_id });
  if(error) throw error;
}

async function uploadCOAandGL(){
  const coaText = await readFile($("coaFile"));
  const glText  = await readFile($("glFile"));
  if(!coaText || !glText) throw new Error("Please select both COA and GL CSV files.");

  $("uploadErr").textContent="";
  $("uploadHint").textContent="Parsing CSV…";

  // Parse COA
  const coaCsv = parseCSV(coaText);
  const coaRows = toObjects(coaCsv).map(r=>({
    engagement_id,
    account_code: (r.account_code || r["account_code"] || r["Account Code"] || "").trim(),
    account_name: (r.account_name || r["account_name"] || r["Account Name"] || "").trim(),
    normal_balance: (r.normal_balance || r["normal_balance"] || r["Normal Balance"] || "").trim().toUpperCase() || null,
    statement: (r.statement || r["statement"] || "").trim().toUpperCase() || null,
    section: (r.section || r["section"] || "").trim() || null,
    line_item: (r.line_item || r["line_item"] || "").trim() || null,
  })).filter(x=>x.account_code);

  // Parse GL
  const glCsv = parseCSV(glText);
  const glRows = toObjects(glCsv).map(r=>({
    engagement_id,
    txn_date: (r.txn_date || r["txn_date"] || r["Date"] || "").trim() || null,
    voucher_no: (r.voucher_no || r["voucher_no"] || r["Voucher"] || "").trim() || null,
    account_code: (r.account_code || r["account_code"] || r["Account Code"] || "").trim(),
    description: (r.description || r["description"] || r["Narration"] || "").trim() || null,
    debit: Number((r.debit || r["debit"] || r["Debit"] || "0").toString().replace(/,/g,"")) || 0,
    credit: Number((r.credit || r["credit"] || r["Credit"] || "0").toString().replace(/,/g,"")) || 0,
  })).filter(x=>x.account_code);

  if(!coaRows.length) throw new Error("COA file parsed but no rows found (check headers).");
  if(!glRows.length) throw new Error("GL file parsed but no rows found (check headers).");

  $("uploadHint").textContent=`Uploading COA (${coaRows.length})…`;
  await sb.rpc("replace_coa", { p_engagement_id: engagement_id }); // clears prior COA (server side)
  await batchInsert("coa_accounts", coaRows, 500);

  $("uploadHint").textContent=`Uploading GL (${glRows.length})…`;
  await sb.rpc("replace_gl", { p_engagement_id: engagement_id }); // clears prior GL (server side)
  await batchInsert("gl_entries", glRows, 1000);

  $("uploadHint").textContent="Done. Trial Balance + statements updated in realtime.";
}

async function generateLeadSchedules(){
  const { error } = await sb.rpc("generate_lead_schedules", { p_engagement_id: engagement_id });
  if(error) throw error;
}

function wireFSRealtime(){
  const badge = $("syncState");
  const set = (t)=>{ if(badge) badge.textContent=t; };

  const ch = sb.channel(`fs-${engagement_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"gl_entries", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (GL)"))
    .on("postgres_changes", { event:"*", schema:"public", table:"coa_accounts", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (COA)"))
    .on("postgres_changes", { event:"*", schema:"public", table:"lead_schedules", filter:`engagement_id=eq.${engagement_id}` }, ()=> set("Updated (Lead)"))
    .subscribe();

  set("Connected");
  return ch;
}

async function bootFS(){
  await ensureSession();
  if(!engagement_id) { location.href="dashboard.html"; return; }

  $("btnLogout")?.addEventListener("click", logout);

  // Link to audit page with same engagement_id
  const toAudit = $("btnToAudit");
  if(toAudit) toAudit.href = `audit-program.html?engagement_id=${encodeURIComponent(engagement_id)}`;

  // Side nav
  document.querySelectorAll(".child[data-page]").forEach(x=>{
    x.addEventListener("click", async ()=>{
      const p=x.dataset.page;
      setFSPage(p);
      try{
        if(p==="tb") await renderTB();
        if(p==="sofp") await renderStatement("sofp_v", "page_sofp");
        if(p==="sopl") await renderStatement("sopl_v", "page_sopl");
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

  // Header
  const eng = await loadEngagement();
  $("pillEng").textContent = `${eng.client?.name || ""} — ${eng.name || "Engagement"} (${eng.year_end || "—"})`;

  wireFSRealtime();
  setFSPage("upload");
}

/* ---------------- Audit Program page (procedures + lead schedule sync) ---------------- */
function isAuditPage(){
  return !!$("tree") && !!$("panelLead") && !isFSPage();
}

function buildTree(){
  const tree = $("tree");
  tree.innerHTML="";

  const contents = window.PROGRAM_DB?.contents || [];
  contents.forEach(section=>{
    const node = el("div","node");
    const hdr = el("div","nodehdr");
    const left = el("div","left");
    const caret = el("div","caret"); caret.textContent="›";
    const title = el("div","nodetitle"); title.textContent=section.sectionTitle || "Section";
    left.append(caret,title);
    hdr.append(left);

    const children = el("div","children");
    (section.items||[]).forEach(item=>{
      const ch = el("div","child");
      ch.dataset.key = item.key;
      ch.innerHTML = `<div class="ctitle">${item.label}</div><div class="cmeta">${item.key}</div>`;
      children.append(ch);
    });

    node.append(hdr, children);
    tree.append(node);

    // simple collapse/expand
    hdr.addEventListener("click", ()=>{
      const open = children.style.display !== "none";
      children.style.display = open ? "none" : "flex";
      caret.textContent = open ? "›" : "⌄";
    });
  });
}

function setAreaTabs(active){
  document.querySelectorAll(".area-tab").forEach(b=>b.classList.toggle("active", b.dataset.areaTab===active));
  $("panelLead").style.display = active==="lead" ? "" : "none";
  $("panelFieldwork").style.display = active==="fieldwork" ? "" : "none";
  $("panelConclusion").style.display = active==="conclusion" ? "" : "none";
}

function setPhaseTabs(active){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.phase===active));
}

let currentAreaKey = null;
let currentFSKey = null; // FS_* items in contents

function calcProgress(responses){
  const total = responses.length || 0;
  if(!total) return 0;
  const done = responses.filter(r=>r.answer && r.answer!=="").length;
  return Math.round((done/total)*100);
}

async function upsertResponse(step_id, answer){
  const { error } = await sb.from("procedure_responses")
    .upsert({ engagement_id, step_id, answer }, { onConflict:"engagement_id,step_id" });
  if(error) throw error;
}

async function loadResponses(area_key, phase){
  const { data, error } = await sb
    .from("procedure_responses")
    .select("step_id, answer, updated_at, updated_by")
    .eq("engagement_id", engagement_id)
    .eq("area_key", area_key)
    .eq("phase", phase);
  if(error) throw error;
  const map=new Map();
  (data||[]).forEach(r=>map.set(r.step_id, r));
  return map;
}

function renderSteps(area_key, phase){
  const area = window.PROGRAM_DB?.areas?.[area_key];
  const stepsBox = $("steps");
  stepsBox.innerHTML="";

  const steps = area?.procedures?.[phase] || [];
  steps.forEach((s, idx)=>{
    const row = el("div","row");
    const left = el("div");
    const t = el("div","rtext"); t.textContent = s.text || s.heading || `Step ${idx+1}`;
    const sub = el("div","rsub"); sub.textContent = s.id ? `ID: ${s.id}` : "";
    left.append(t,sub);

    const decision = el("div","decision");
    const mk = (val, lbl) => {
      const lab = document.createElement("label");
      const inp = document.createElement("input");
      inp.type="radio";
      inp.name = `step_${area_key}_${phase}_${s.id||idx}`;
      inp.value = val;
      lab.append(inp, document.createTextNode(" "+lbl));
      lab.addEventListener("click", async ()=>{
        try{
          await sb.rpc("upsert_procedure_response", {
            p_engagement_id: engagement_id,
            p_area_key: area_key,
            p_phase: phase,
            p_step_id: s.id || `${area_key}-${phase}-${idx+1}`,
            p_answer: val
          });
        }catch(e){ console.error(e); }
      });
      return lab;
    };
    decision.append(mk("Yes","Yes"), mk("No","No"), mk("N/A","N/A"));

    const acts = el("div","row-actions");
    const btn = el("button","ghost");
    btn.textContent="Comment";
    btn.onclick=async ()=>{
      const msg = prompt("Comment:");
      if(!msg) return;
      await sb.from("comments").insert({
        engagement_id,
        area_key,
        phase,
        step_id: s.id || `${area_key}-${phase}-${idx+1}`,
        body: msg
      });
    };
    acts.append(btn);

    row.append(left, decision, acts);
    stepsBox.append(row);
  });
}

async function refreshLeadFromFS(){
  // Pull generated lead schedule from server (generated in FS page)
  const { data, error } = await sb
    .from("lead_schedule_lines")
    .select("row_no, col_no, value")
    .eq("engagement_id", engagement_id)
    .eq("area_key", currentAreaKey)
    .order("row_no")
    .order("col_no");
  if(error) throw error;

  // Build grid
  const dz = $("lsDropzone");
  const wrap = $("lsGridWrap");
  const grid = $("lsGrid");
  const inner = $("lsDropzoneInner");
  const meta = $("lsGridMeta");

  if(!data?.length){
    inner.querySelector(".ls-dz-title").textContent = "No generated Lead Schedule found";
    inner.querySelector(".ls-dz-sub").textContent = "Go to Financial Statements → Lead Schedules → Generate, then come back.";
    dz.style.display="";
    wrap.style.display="none";
    return;
  }

  // Determine size
  let maxR=0, maxC=0;
  data.forEach(x=>{ if(x.row_no>maxR) maxR=x.row_no; if(x.col_no>maxC) maxC=x.col_no; });

  const matrix = Array.from({length:maxR+1}, ()=> Array.from({length:maxC+1}, ()=>""));
  data.forEach(x=>{ matrix[x.row_no][x.col_no] = x.value || ""; });

  // Render table
  grid.innerHTML="";
  const thead = el("thead");
  const trh = el("tr");
  // row number column
  const thRn = el("th","ls-rn"); thRn.textContent="#"; trh.append(thRn);
  for(let c=1;c<=maxC;c++){
    const th=el("th");
    th.innerHTML = `<div class="ls-ch-inner">C${c}</div>`;
    trh.append(th);
  }
  thead.append(trh);
  grid.append(thead);

  const tbody = el("tbody");
  for(let r=1;r<=maxR;r++){
    const tr=el("tr");
    const rn = el("td","ls-rn");
    rn.innerHTML = `${r} <button class="ls-row-del" title="Delete row">×</button>`;
    tr.append(rn);
    for(let c=1;c<=maxC;c++){
      const td=el("td","ls-cell");
      const div=el("div","ls-cell-inner");
      div.contentEditable="true";
      div.textContent = matrix[r][c] || "";
      td.append(div);
      tr.append(td);
    }
    tbody.append(tr);
  }
  grid.append(tbody);

  dz.style.display="none";
  wrap.style.display="";
  meta.textContent = `Rows: ${maxR} • Cols: ${maxC} • Source: FS (lead_schedule_lines)`;
}

function wirePasteExcel(){
  const dz = $("lsDropzone");
  const gridWrap = $("lsGridWrap");
  const grid = $("lsGrid");

  function parseClipboard(text){
    const lines = text.split(/\r?\n/).filter(l=>l.length);
    return lines.map(l => l.split("\t"));
  }

  async function applyMatrix(matrix){
    // Render simple grid
    grid.innerHTML="";
    const maxC = Math.max(...matrix.map(r=>r.length));
    const thead = el("thead");
    const trh = el("tr");
    const thRn = el("th","ls-rn"); thRn.textContent="#"; trh.append(thRn);
    for(let c=0;c<maxC;c++){
      const th=el("th");
      th.innerHTML = `<div class="ls-ch-inner">C${c+1}</div>`;
      trh.append(th);
    }
    thead.append(trh);
    grid.append(thead);

    const tbody = el("tbody");
    matrix.forEach((r,ri)=>{
      const tr=el("tr");
      const rn = el("td","ls-rn");
      rn.innerHTML = `${ri+1} <button class="ls-row-del" title="Delete row">×</button>`;
      tr.append(rn);
      for(let c=0;c<maxC;c++){
        const td=el("td","ls-cell");
        const div=el("div","ls-cell-inner");
        div.contentEditable="true";
        div.textContent = r[c] ?? "";
        td.append(div);
        tr.append(td);
      }
      tbody.append(tr);
    });
    grid.append(tbody);

    dz.style.display="none";
    gridWrap.style.display="";
    $("lsGridMeta").textContent = `Rows: ${matrix.length} • Cols: ${maxC} • Source: Clipboard`;
  }

  async function pasteFromClipboard(){
    const t = await navigator.clipboard.readText();
    if(!t) return;
    const matrix = parseClipboard(t);
    await applyMatrix(matrix);
  }

  dz?.addEventListener("click", pasteFromClipboard);
  $("btnLsPaste")?.addEventListener("click", pasteFromClipboard);
}

async function bootAudit(){
  await ensureSession();
  if(!engagement_id) { location.href="dashboard.html"; return; }

  $("btnLogout")?.addEventListener("click", logout);
  const toFS = $("btnToFS");
  if(toFS) toFS.href = `financial-statements.html?engagement_id=${encodeURIComponent(engagement_id)}`;

  const eng = await loadEngagement();
  $("pillEng").textContent = `${eng.client?.name || ""} — ${eng.name || "Engagement"} (${eng.year_end || "—"})`;

  buildTree();

  // Outer tabs
  document.querySelectorAll(".area-tab").forEach(b=>{
    b.addEventListener("click", ()=> setAreaTabs(b.dataset.areaTab));
  });

  // Phase tabs (fieldwork)
  document.querySelectorAll(".tab").forEach(b=>{
    b.addEventListener("click", ()=>{
      setPhaseTabs(b.dataset.phase);
      if(currentAreaKey){
        renderSteps(currentAreaKey, b.dataset.phase);
      }
    });
  });

  // Select first Audit Program area
  const firstAudit = window.PROGRAM_DB?.contents?.find(x=>x.sectionTitle==="Audit Program")?.items?.[0]?.key;
  currentAreaKey = firstAudit || "PPE";

  // Click on contents
  document.querySelectorAll(".child").forEach(ch=>{
    ch.addEventListener("click", async ()=>{
      document.querySelectorAll(".child").forEach(x=>x.classList.remove("active"));
      ch.classList.add("active");

      const key = ch.dataset.key;

      // If user clicked an FS item, open FS page (linked)
      if(key && key.startsWith("FS_")){
        location.href = `financial-statements.html?engagement_id=${encodeURIComponent(engagement_id)}`;
        return;
      }

      currentAreaKey = key;
      const area = window.PROGRAM_DB?.areas?.[key];
      $("crumbTitle").textContent = area?.title || key;
      $("crumbSub").textContent = "Lead Schedule / Fieldwork / Conclusion";

      // Default to lead tab
      setAreaTabs("lead");
      await refreshLeadFromFS();

      // Also render steps (fieldwork tab uses current phase)
      const activePhase = document.querySelector(".tab.active")?.dataset.phase || "Analytical Procedures";
      renderSteps(currentAreaKey, activePhase);
    });
  });

  // Initialize crumb
  const area = window.PROGRAM_DB?.areas?.[currentAreaKey];
  $("crumbTitle").textContent = area?.title || currentAreaKey;
  $("crumbSub").textContent = "Lead Schedule / Fieldwork / Conclusion";

  // Lead schedule buttons
  $("btnLsRefresh")?.addEventListener("click", async ()=>{
    $("lsSyncStatus").textContent="Refreshing…";
    try{ await refreshLeadFromFS(); $("lsSyncStatus").textContent="Updated"; }
    catch(e){ console.error(e); $("lsSyncStatus").textContent="Error"; }
  });
  $("btnLsClear")?.addEventListener("click", ()=>{
    $("lsDropzone").style.display="";
    $("lsGridWrap").style.display="none";
    $("lsGrid").innerHTML="";
    $("lsGridMeta").textContent="";
  });

  wirePasteExcel();

  // Realtime: when lead lines update, show quick badge
  sb.channel(`audit-${engagement_id}`)
    .on("postgres_changes", { event:"*", schema:"public", table:"lead_schedule_lines", filter:`engagement_id=eq.${engagement_id}` }, ()=>{
      $("lsSyncStatus").textContent="Updated (FS)";
      // Auto-refresh only if currently viewing lead
      if(document.querySelector(".area-tab.active")?.dataset.areaTab==="lead"){
        refreshLeadFromFS().catch(()=>{});
      }
    })
    .subscribe();

  // First load
  setAreaTabs("lead");
  setPhaseTabs("Analytical Procedures");
  await refreshLeadFromFS();
  renderSteps(currentAreaKey, "Analytical Procedures");
}

(async function main(){
  if(isFSPage()) return bootFS();
  if(isAuditPage()) return bootAudit();
})();
