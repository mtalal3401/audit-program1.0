// MT - FY & Co. Audit Software (v3.4)
// Vanilla JS + Supabase (Auth, RLS, Realtime)
//
// WHAT'S IN v3.2 (per your request):
// ✅ Procedure comments remain (stored in procedure_comments + shown in export)
// ✅ NO comments for Prepared/Reviewed/Signed Off/N/A actions (no prompt, no DB)
// ✅ NO highlight on procedure comment buttons (plain black text; no emphasis)
//
// IMPORTANT (index.html):
//   <script src="procedures-db.js"></script>
//   <script src="app_new_comments_v3_4.js"></script>

(() => {
  // -------------------------
  // Utilities
  // -------------------------
  const $ = (id) => document.getElementById(id);
  const nowISO = () => new Date().toISOString();

  // Date formatting (DD MMM YYYY) + (DD MMM YYYY HH:MM)
  const _fmtDate = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const _fmtDateTime = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  function fmtDate(isoOrDate) {
    if (!isoOrDate) return '';
    const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate);
    return _fmtDate.format(d);
  }
  function fmtDateTime(isoOrDate) {
    if (!isoOrDate) return '';
    const d = (isoOrDate instanceof Date) ? isoOrDate : new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate);
    return _fmtDateTime.format(d);
  }


  function assertSupabaseReady() {
    if (!window.sb) throw new Error("Supabase client not found. Ensure window.sb is initialized before app_new_comments_v3_4.js.");
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // -------------------------
  // Program DB (procedures)
  // -------------------------
  const PROGRAM_DB = window.PROGRAM_DB || null;
  if (!PROGRAM_DB) {
    // Fallback minimal DB if procedures-db.js isn't loaded
    window.PROGRAM_DB = {
      meta: { version: "fallback", lastUpdated: new Date().toISOString() },
      areas: {
        PPE: {
          title: "Property, Plant and Equipment",
          procedures: { "Analytical Procedures": [], "Test of Controls": [], "Test of Details": [] }
        }
      },
      contents: [{items: [{ key: "PPE", label: "Property, Plant and Equipment" }] }]
    };
  }

  const PROGRAM = window.PROGRAM_DB.areas;
  const CONTENTS_DB = window.PROGRAM_DB.contents;
  const PHASES = ["Analytical Procedures", "Test of Controls", "Test of Details"];

  // -------------------------
  // Roles
  // -------------------------
  const ROLE_LEVEL = { Junior: 1, Reviewer: 2, Partner: 3 };
  function roleAtLeast(role, minRole) {
    return (ROLE_LEVEL[role] || 0) >= (ROLE_LEVEL[minRole] || 0);
  }

  // -------------------------
  // App state
  // -------------------------
  const state = {
    user: null,
    engagements: [],
    engagementId: null,
    activeAreaKey: CONTENTS_DB?.[0]?.items?.[0]?.key || "PPE",
    activePhase: "Analytical Procedures",
    responses: {},
    signoff: {},
    procedureComments: {} // procedureComments[area][phase][procedure_id] = [{id,text,created_at,created_by}]
  };

  // Profile cache (for export + comment author display)
  const profileCache = new Map();
  function cacheProfiles(list) {
    (list || []).forEach((p) => {
      if (p?.user_id) profileCache.set(p.user_id, p);
    });
  }
  async function sbGetProfilesByIds(ids) {
    assertSupabaseReady();
    const uniq = [...new Set((ids || []).filter(Boolean))].filter((x) => !profileCache.has(x));
    if (!uniq.length) return;
    const { data, error } = await window.sb.from("profiles").select("user_id,email,username,role").in("user_id", uniq);
    if (error) throw error;
    cacheProfiles(data);
  }
  function whoName(userId) {
    const p = profileCache.get(userId);
    return p?.username || p?.email || userId || "";
  }

  // -------------------------
  // Helpers
  // -------------------------
  function getAreaTitle(areaKey) {
    return PROGRAM?.[areaKey]?.title || areaKey;
  }
  function getProcedureId(areaKey, phase, procedure, index) {
    return procedure?.id || `${areaKey}-${phase}-${index + 1}`;
  }
  function ensurePhaseResponses(areaKey, phase) {
    state.responses[areaKey] ??= {};
    state.responses[areaKey][phase] ??= {};
    return state.responses[areaKey][phase];
  }
  function ensureAreaSignoff(areaKey) {
    state.signoff[areaKey] ??= { prepared: null, reviewed: null, signedOff: null, na: null };
    return state.signoff[areaKey];
  }
  function getProcedureComments(areaKey, phase, pid) {
    return state.procedureComments?.[areaKey]?.[phase]?.[pid] || [];
  }

  // -------------------------
  // Completion / status
  // -------------------------
  function getAreaCompletion(areaKey) {
    let total = 0, completed = 0;
    PHASES.forEach((phase) => {
      const list = PROGRAM?.[areaKey]?.procedures?.[phase] || [];
      const phaseResponses = ensurePhaseResponses(areaKey, phase);
      total += list.length;
      completed += list.filter((p, idx) => {
        const pid = getProcedureId(areaKey, phase, p, idx);
        return !!phaseResponses[pid]?.status;
      }).length;
    });
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }

  function getOverallCompletion() {
    let total = 0, completed = 0;
    Object.keys(PROGRAM || {}).forEach((areaKey) => {
      const c = getAreaCompletion(areaKey);
      total += c.total;
      completed += c.completed;
    });
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }

  function areaStatus(areaKey) {
    const so = ensureAreaSignoff(areaKey);
    if (so.na) return "N/A";
    if (so.signedOff) return "Signed Off";
    if (so.reviewed) return "Reviewed";
    if (so.prepared) return "Prepared";
    const c = getAreaCompletion(areaKey);
    if (c.total > 0 && c.completed >= c.total) return "Completed";
    return "In progress";
  }

  function signoffLockText(areaKey) {
    const so = ensureAreaSignoff(areaKey);
    if (so.na) return "Locked: N/A selected";
    if (so.signedOff) return "Status: Signed Off";
    if (so.reviewed) return "Status: Reviewed";
    if (so.prepared) return "Status: Prepared";
    const c = getAreaCompletion(areaKey);
    if (c.total > 0 && c.completed >= c.total) return "Status: Completed";
    return "Status: In progress";
  }

  // -------------------------
  // Supabase auth/profile
  // -------------------------
  async function sbSignIn(email, password) {
    assertSupabaseReady();
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function sbSignOut() {
    assertSupabaseReady();
    const { error } = await window.sb.auth.signOut();
    if (error) throw error;
  }

  async function sbEnsureProfile(user) {
    assertSupabaseReady();
    const email = user?.email || "";
    const username = (email ? email.split("@")[0] : "user").slice(0, 64);

    const { data, error } = await window.sb
      .from("profiles")
      .select("user_id,email,username,role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;

    const payload = { user_id: user.id, email, username, role: "Junior" };
    const { error: insErr } = await window.sb.from("profiles").insert(payload);
    if (insErr) throw insErr;
    return payload;
  }

  // -------------------------
  // Engagements
  // -------------------------
  async function sbListMyEngagements() {
    assertSupabaseReady();
    const { data, error } = await window.sb
      .from("engagements")
      .select("id, client_name, year_end, expected_completion_date, created_at, created_by")
      .order("created_at", { ascending: false });
    if (error) throw error;
    await sbGetProfilesByIds((data || []).map((x) => x.created_by));
    return data || [];
  }

  async function sbCreateEngagement({ client_name, year_end, expected_completion_date }) {
    assertSupabaseReady();
    const { data, error } = await window.sb
      .from("engagements")
      .insert({
        client_name,
        year_end,
        expected_completion_date: expected_completion_date || null,
        created_by: state.user.id
      })
      .select("id, client_name, year_end, expected_completion_date, created_at, created_by")
      .single();
    if (error) throw error;

    // make creator a member
    const { error: e2 } = await window.sb.from("engagement_members").insert({
      engagement_id: data.id,
      user_id: state.user.id,
      member_role: state.user.role
    });
    if (e2) throw e2;

    return data;
  }

  // -------------------------
  // Load engagement data
  // -------------------------
  async function sbLoadProcedureComments(engagementId) {
    const { data, error } = await window.sb
      .from("procedure_comments")
      .select("id, engagement_id, area_key, phase, procedure_id, comment_text, created_by, created_at")
      .eq("engagement_id", engagementId)
      .order("created_at", { ascending: true });
    if (error) throw error;

    state.procedureComments = {};
    const needProfiles = [];
    (data || []).forEach((c) => {
      state.procedureComments[c.area_key] ??= {};
      state.procedureComments[c.area_key][c.phase] ??= {};
      state.procedureComments[c.area_key][c.phase][c.procedure_id] ??= [];
      state.procedureComments[c.area_key][c.phase][c.procedure_id].push({
        id: c.id,
        text: c.comment_text,
        created_at: c.created_at,
        created_by: c.created_by
      });
      if (c.created_by) needProfiles.push(c.created_by);
    });
    await sbGetProfilesByIds(needProfiles);
  }

  async function sbLoadEngagementData(engagementId) {
    state.responses = {};
    state.signoff = {};
    state.procedureComments = {};

    const needProfiles = [];

    const { data: procRows, error: pErr } = await window.sb
      .from("procedure_responses")
      .select("*")
      .eq("engagement_id", engagementId);
    if (pErr) throw pErr;

    (procRows || []).forEach((r) => {
      state.responses[r.area_key] ??= {};
      state.responses[r.area_key][r.phase] ??= {};
      state.responses[r.area_key][r.phase][r.procedure_id] = {
        status: r.status,
        notes: r.notes,
        updated_at: r.updated_at,
        updated_by: r.updated_by
      };
      if (r.updated_by) needProfiles.push(r.updated_by);
    });

    const { data: soRows, error: sErr } = await window.sb
      .from("signoffs")
      .select("*")
      .eq("engagement_id", engagementId);
    if (sErr) throw sErr;

    (soRows || []).forEach((s) => {
      state.signoff[s.area_key] = { ...(s.data || {}) };
      if (s.updated_by) needProfiles.push(s.updated_by);
    });

    await sbLoadProcedureComments(engagementId);
    await sbGetProfilesByIds(needProfiles);
  }

  // -------------------------
  // Comment insert (procedure only)
  // -------------------------
  async function sbAddProcedureComment({ engagement_id, area_key, phase, procedure_id, text }) {
    const row = { engagement_id, area_key, phase, procedure_id, comment_text: text, created_by: state.user.id };
    const { error } = await window.sb.from("procedure_comments").insert(row);
    if (error) throw error;
  }

  // -------------------------
  // Realtime
  // -------------------------
  let rtChannel = null;
  function rtStop() {
    try { if (rtChannel) window.sb.removeChannel(rtChannel); } catch {}
    rtChannel = null;
  }

  function safeRerender() {
    try { renderSteps(); } catch {}
    try { renderSignoff(); } catch {}
    try { renderDashboard(); } catch {}
    try { updateContentsBadges(); } catch {}
  }

  function rtStart(engagementId) {
    rtStop();
    if (!engagementId) return;

    rtChannel = window.sb
      .channel(`engagement:${engagementId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "procedure_responses", filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const r = payload.new;
        if (!r) return;
        sbGetProfilesByIds([r.updated_by]).catch(() => {});
        state.responses[r.area_key] ??= {};
        state.responses[r.area_key][r.phase] ??= {};
        state.responses[r.area_key][r.phase][r.procedure_id] = {
          status: r.status,
          notes: r.notes,
          updated_at: r.updated_at,
          updated_by: r.updated_by
        };
        safeRerender();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "signoffs", filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const s = payload.new;
        if (!s) return;
        if (s.area_key) state.signoff[s.area_key] = { ...(s.data || {}) };
        safeRerender();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "procedure_comments", filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const c = payload.new;
        if (!c) return;
        sbGetProfilesByIds([c.created_by]).catch(() => {});
        state.procedureComments[c.area_key] ??= {};
        state.procedureComments[c.area_key][c.phase] ??= {};
        state.procedureComments[c.area_key][c.phase][c.procedure_id] ??= [];
        state.procedureComments[c.area_key][c.phase][c.procedure_id].push({
          id: c.id,
          text: c.comment_text,
          created_at: c.created_at,
          created_by: c.created_by
        });

        // refresh modal if open for this procedure
        if (commentModalState.open &&
            commentModalState.area_key === c.area_key &&
            commentModalState.phase === c.phase &&
            commentModalState.procedure_id === c.procedure_id) {
          renderCommentModal();
        }
        safeRerender();
      })
      .subscribe();
  }

  // -------------------------
  // Writes (buffered)
  // -------------------------
  let flushTimer = null;
  const pendingUpserts = new Map();
  const pendingSignoffs = new Map();

  function queueProcedureUpsert(row) {
    const key = `${row.engagement_id}::${row.area_key}::${row.phase}::${row.procedure_id}`;
    pendingUpserts.set(key, row);
    scheduleFlush();
  }
  function queueSignoffUpsert(row) {
    const key = `${row.engagement_id}::${row.area_key}`;
    pendingSignoffs.set(key, row);
    scheduleFlush();
  }

  function ensureSyncErrorSlot() {
    if ($("syncError")) return;
    const div = document.createElement("div");
    div.id = "syncError";
    div.style.cssText =
      "position:fixed;left:18px;bottom:18px;max-width:520px;background:#FEF2F2;border:1px solid #FCA5A5;color:#7F1D1D;padding:10px 12px;border-radius:12px;font-weight:700;z-index:9999;";
    div.textContent = "";
    div.style.display = "none";
    document.body.appendChild(div);
  }

  function showSyncError(e) {
    console.error(e);
    const el = $("syncError");
    if (el) {
      el.textContent = e?.message || "Sync failed (check RLS policies).";
      el.style.display = "block";
    }
    setTimeout(() => {
      const x = $("syncError");
      if (x) {
        x.textContent = "";
        x.style.display = "none";
      }
    }, 6000);
  }

  function scheduleFlush() {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flushNow().catch(showSyncError), 250);
  }

  async function flushNow() {
    if (!state.user || !state.engagementId) return;
    assertSupabaseReady();

    const procRows = [...pendingUpserts.values()];
    const soRows = [...pendingSignoffs.values()];
    pendingUpserts.clear();
    pendingSignoffs.clear();

    if (procRows.length) {
      const { error } = await window.sb.from("procedure_responses").upsert(procRows);
      if (error) throw error;
    }
    if (soRows.length) {
      const { error } = await window.sb.from("signoffs").upsert(soRows);
      if (error) throw error;
    }
  }

  // -------------------------
  // Comments modal (procedure only)
  // -------------------------
  const commentModalState = { open: false, area_key: null, phase: null, procedure_id: null };

  function ensureCommentModal() {
    if ($("commentModal")) return;

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = "commentModal";
    modal.innerHTML = `
      <div class="card" style="max-width:720px;">
        <div class="cardhead">
          <h2 id="commentTitle">Comments</h2>
          <button class="iconbtn" id="closeCommentModal" type="button" title="Close">×</button>
        </div>
        <div class="cardbody">
          <div class="hint" id="commentProcMeta" style="margin:0 0 10px;"></div>
          <div id="commentList" style="max-height:320px; overflow:auto; border:1px solid #e6e9ef; border-radius:12px; padding:10px;"></div>

          <div class="field" style="margin-top:12px;">
            <label for="commentText">Add a comment</label>
            <textarea id="commentText" rows="3" placeholder="Write your comment..."></textarea>
          </div>

          <div class="actions" style="justify-content:flex-start;">
            <button class="primary" id="btnAddComment" type="button">Add comment</button>
            <button class="ghost" id="btnCloseComment2" type="button">Close</button>
          </div>
          <div class="hint small" id="commentError" style="color:#b42318;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    $("closeCommentModal").addEventListener("click", closeCommentModal);
    $("btnCloseComment2").addEventListener("click", closeCommentModal);
    $("btnAddComment").addEventListener("click", submitCommentFromModal);
  }

  function openCommentModal({ area_key, phase, procedure_id }) {
    ensureCommentModal();
    commentModalState.open = true;
    commentModalState.area_key = area_key;
    commentModalState.phase = phase;
    commentModalState.procedure_id = procedure_id;
    $("commentError").textContent = "";
    $("commentText").value = "";
    renderCommentModal();
    $("commentModal").classList.add("show");
    setTimeout(() => $("commentText")?.focus(), 30);
  }

  function closeCommentModal() {
    commentModalState.open = false;
    $("commentModal")?.classList.remove("show");
  }

  function renderCommentModal() {
    if (!commentModalState.open) return;
    const { area_key, phase, procedure_id } = commentModalState;
    const comments = getProcedureComments(area_key, phase, procedure_id);

    $("commentProcMeta").textContent = `${getAreaTitle(area_key)} · ${phase} · ${procedure_id}`;
    $("commentTitle").textContent = `Comments (${comments.length})`;

    const list = $("commentList");
    if (!comments.length) {
      list.innerHTML = `<div class="hint">No comments yet.</div>`;
      return;
    }

    list.innerHTML = comments.map((c) => {
      const when = c.created_at ? fmtDateTime(c.created_at) : "";
      const by = c.created_by ? whoName(c.created_by) : "";
      return `
        <div style="padding:8px 8px; border-bottom:1px solid #f0f2f6;">
          <div style="font-weight:700;">${escapeHtml(by || "—")} <span class="hint small" style="font-weight:400;">· ${escapeHtml(when)}</span></div>
          <div style="margin-top:4px; white-space:pre-wrap;">${escapeHtml(c.text)}</div>
        </div>
      `;
    }).join("");
  }

  async function submitCommentFromModal() {
    try {
      if (!state.user || !state.engagementId) return;
      const txt = ($("commentText").value || "").trim();
      if (!txt) {
        $("commentError").textContent = "Please write a comment.";
        return;
      }
      $("commentError").textContent = "";

      await sbAddProcedureComment({
        engagement_id: state.engagementId,
        area_key: commentModalState.area_key,
        phase: commentModalState.phase,
        procedure_id: commentModalState.procedure_id,
        text: txt
      });

      $("commentText").value = "";
    } catch (e) {
      console.error(e);
      $("commentError").textContent = e?.message || "Could not add comment.";
    }
  }

  // -------------------------
  // UI rendering
  // -------------------------
  function renderAreaHeader() {
    $("crumbTitle").textContent = getAreaTitle(state.activeAreaKey);
    $("crumbSub").textContent = `Steps · ${state.activePhase}`;
  }

  function renderTabs() {
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.getAttribute("data-phase") === state.activePhase);
    });
  }

  function updateProgress() {
    const c = getAreaCompletion(state.activeAreaKey);
    $("barFill").style.width = `${c.pct}%`;
    $("pctTxt").textContent = `${c.pct}%`;
    $("lockNote").textContent = signoffLockText(state.activeAreaKey);
  }

  function renderSteps() {
    const areaKey = state.activeAreaKey;
    const phase = state.activePhase;
    const list = PROGRAM?.[areaKey]?.procedures?.[phase] || [];
    const phaseResponses = ensurePhaseResponses(areaKey, phase);
    const so = ensureAreaSignoff(areaKey);

    const locked = !!so.na || !!so.signedOff;
    const dis = locked ? "disabled" : "";

    const stepsWrap = $("steps");
    stepsWrap.innerHTML = "";

    if (!list.length) {
      stepsWrap.innerHTML = `
        <div class="row">
          <div>
            <div class="rtext">No procedures added for this area yet.</div>
            <div class="rsub"></div>
          </div>
          <div></div><div></div>
        </div>
      `;
      updateProgress();
      return;
    }

    list.forEach((p, idx) => {
      const procedureId = getProcedureId(areaKey, phase, p, idx);
      const response = phaseResponses[procedureId] || {};
      const when = response.updated_at ? fmtDateTime(response.updated_at) : "";
      const by = response.updated_by ? whoName(response.updated_by) : "";

      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div>
          <div class="rtext">${idx + 1}. ${escapeHtml(p.text || "")}</div>
          <div class="rsub">
            ${escapeHtml(p.heading || "")} · ${escapeHtml(phase)}
            · <span class="small">Last update: ${escapeHtml(when)}${by ? " · " + escapeHtml(by) : ""}</span>
          </div>
        </div>
        <div class="decision">
          <label><input type="radio" name="${escapeHtml(procedureId)}" value="yes" ${response.status === "yes" ? "checked" : ""} ${dis}/><span>Yes</span></label>
          <label><input type="radio" name="${escapeHtml(procedureId)}" value="no" ${response.status === "no" ? "checked" : ""} ${dis}/><span>No</span></label>
          <label><input type="radio" name="${escapeHtml(procedureId)}" value="na" ${response.status === "na" ? "checked" : ""} ${dis}/><span>N/A</span></label>
        </div>
        <div class="row-actions" style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn" type="button" data-comment="1"
            title="Comments"
            data-area="${escapeHtml(areaKey)}"
            data-phase="${escapeHtml(phase)}"
            data-pid="${escapeHtml(procedureId)}">💬</button>
        </div>
      `;
      stepsWrap.appendChild(row);
    });

    bindProcedureInputs();
    bindCommentButtons();
    updateProgress();
  }

  function bindProcedureInputs() {
    document.querySelectorAll(".decision input[type='radio']").forEach((input) => {
      input.addEventListener("change", (e) => {
        const procedureId = e.target.name;
        const status = e.target.value;

        const areaKey = state.activeAreaKey;
        const phase = state.activePhase;
        const phaseResponses = ensurePhaseResponses(areaKey, phase);

        const updated_at = nowISO();
        phaseResponses[procedureId] = {
          ...(phaseResponses[procedureId] || {}),
          status,
          updated_at,
          updated_by: state.user.id
        };

        queueProcedureUpsert({
          engagement_id: state.engagementId,
          area_key: areaKey,
          phase,
          procedure_id: procedureId,
          status,
          notes: phaseResponses[procedureId].notes ?? null,
          updated_at,
          updated_by: state.user.id
        });

        renderSteps();
        updateContentsBadges();
        renderDashboard();
      });
    });
  }

  function bindCommentButtons() {
    document.querySelectorAll("button[data-comment='1']").forEach((btn) => {
      btn.addEventListener("click", () => {
        openCommentModal({
          area_key: btn.getAttribute("data-area"),
          phase: btn.getAttribute("data-phase"),
          procedure_id: btn.getAttribute("data-pid")
        });
      });
    });
  }

  // -------------------------
  // Signoffs (persisted) - NO COMMENTS
  // -------------------------
  function upsertSignoff(areaKey) {
    const so = ensureAreaSignoff(areaKey);
    queueSignoffUpsert({
      engagement_id: state.engagementId,
      area_key: areaKey,
      data: so,
      updated_at: nowISO(),
      updated_by: state.user.id
    });
    // flush immediately so it persists
    flushNow().catch(showSyncError);
  }

  function renderSignoff() {
    const so = ensureAreaSignoff(state.activeAreaKey);
    $("chkPrepared").checked = !!so.prepared;
    $("chkReviewed").checked = !!so.reviewed;
    $("chkSignedOff").checked = !!so.signedOff;
    $("chkNotApplicable").checked = !!so.na;

    applySignoffRules();
    updateProgress();
  }

  function applySignoffRules() {
    const so = ensureAreaSignoff(state.activeAreaKey);
    const isNA = !!so.na;

    $("chkNotApplicable").disabled = false;
    $("chkPrepared").disabled = isNA || !roleAtLeast(state.user.role, "Junior");
    $("chkReviewed").disabled = isNA || !roleAtLeast(state.user.role, "Reviewer") || !so.prepared;
    $("chkSignedOff").disabled = isNA || !roleAtLeast(state.user.role, "Partner") || !so.reviewed;

    $("lockNote").textContent = signoffLockText(state.activeAreaKey);
  }

  function onPreparedToggle(e) {
    const areaKey = state.activeAreaKey;
    const so = ensureAreaSignoff(areaKey);

    if (!roleAtLeast(state.user.role, "Junior")) {
      e.target.checked = !!so.prepared;
      return;
    }

    if (e.target.checked) {
      const comp = getAreaCompletion(areaKey);
      if (comp.total > 0 && comp.completed < comp.total) {
        e.target.checked = false;
        window.alert(`Cannot mark Prepared until all procedures are answered. Completion: ${comp.pct}% (${comp.completed}/${comp.total}).`);
        return;
      }
      so.prepared = { by: state.user.username, by_id: state.user.id, at: nowISO() };
    } else {
      if (!roleAtLeast(state.user.role, "Reviewer")) {
        e.target.checked = true;
        return;
      }
      so.prepared = null;
      so.reviewed = null;
      so.signedOff = null;
    }

    upsertSignoff(areaKey);
    renderSignoff();
    updateContentsBadges();
    renderDashboard();
  }

  function onReviewedToggle(e) {
    const areaKey = state.activeAreaKey;
    const so = ensureAreaSignoff(areaKey);

    if (!roleAtLeast(state.user.role, "Reviewer")) {
      e.target.checked = !!so.reviewed;
      return;
    }
    if (!so.prepared) {
      e.target.checked = false;
      return;
    }

    if (e.target.checked) {
      const comp = getAreaCompletion(areaKey);
      if (comp.total > 0 && comp.completed < comp.total) {
        e.target.checked = false;
        window.alert(`Cannot mark Reviewed until all procedures are answered. Completion: ${comp.pct}% (${comp.completed}/${comp.total}).`);
        return;
      }
      so.reviewed = { by: state.user.username, by_id: state.user.id, at: nowISO() };
    } else {
      so.reviewed = null;
      so.signedOff = null;
    }

    upsertSignoff(areaKey);
    renderSignoff();
    updateContentsBadges();
    renderDashboard();
  }

  function onSignedOffToggle(e) {
    const areaKey = state.activeAreaKey;
    const so = ensureAreaSignoff(areaKey);

    if (!roleAtLeast(state.user.role, "Partner")) {
      e.target.checked = !!so.signedOff;
      return;
    }
    if (!so.reviewed) {
      e.target.checked = false;
      return;
    }

    if (e.target.checked) {
      const comp = getAreaCompletion(areaKey);
      if (comp.total > 0 && comp.completed < comp.total) {
        e.target.checked = false;
        window.alert(`Cannot Sign Off until all procedures are answered. Completion: ${comp.pct}% (${comp.completed}/${comp.total}).`);
        return;
      }
      so.signedOff = { by: state.user.username, by_id: state.user.id, at: nowISO() };
    } else {
      so.signedOff = null;
    }

    upsertSignoff(areaKey);
    renderSignoff();
    updateContentsBadges();
    renderDashboard();
  }

  function onNAToggle(e) {
    const areaKey = state.activeAreaKey;
    const so = ensureAreaSignoff(areaKey);

    if (e.target.checked) {
      so.na = { by: state.user.username, by_id: state.user.id, at: nowISO() };
      so.prepared = null;
      so.reviewed = null;
      so.signedOff = null;
    } else {
      so.na = null;
    }

    upsertSignoff(areaKey);
    renderSignoff();
    renderSteps();
    updateContentsBadges();
    renderDashboard();
  }

  // -------------------------
  // Contents tree badges
  // -------------------------
  function badgeHtml(label, bg, fg) {
    const style = `display:inline-block;padding:2px 8px;border-radius:999px;font-weight:700;font-size:12px;line-height:18px;background:${bg};color:${fg};border:1px solid rgba(0,0,0,0.06);`;
    return `<span style="${style}">${escapeHtml(label)}</span>`;
  }

  function updateContentsBadges() {
    document.querySelectorAll(".cmeta[data-badge='1']").forEach((el) => {
      const areaKey = el.getAttribute("data-area");
      const c = getAreaCompletion(areaKey);
      const st = areaStatus(areaKey);

      let html = "";
      if (st === "Signed Off") html = badgeHtml("Signed Off", "#DCFCE7", "#14532D");
      else if (st === "Reviewed") html = badgeHtml("Reviewed", "#DBEAFE", "#1E3A8A");
      else if (st === "Prepared") html = badgeHtml("Prepared", "#FEF9C3", "#854D0E");
      else if (st === "N/A") html = badgeHtml("N/A", "#F3F4F6", "#374151");
      else if (st === "Completed") html = badgeHtml("Completed", "#E0E7FF", "#312E81");
      else html = badgeHtml(`${c.pct}%`, "#F1F5F9", "#0F172A");

      el.innerHTML = html;
    });
  }

  function buildContentsTree() {
    const tree = $("tree");
    if (!tree) return;
    tree.innerHTML = "";

    (CONTENTS_DB || []).forEach((section) => {
      const node = document.createElement("div");
      node.className = "node open";
      node.innerHTML = `
        <div class="nodehdr">
          <div class="left">
            <div class="caret">▾</div>
            <div class="nodetitle">${escapeHtml(section.sectionTitle || "")}</div>
          </div>
          <div class="badge">Group</div>
        </div>
        <div class="children"></div>
      `;
      const children = node.querySelector(".children");
      (section.items || []).forEach((item) => {
        const child = document.createElement("div");
        child.className = "child";
        child.dataset.area = item.key;
        child.innerHTML = `
          <div class="ctitle">${escapeHtml(item.label)}</div>
          <div class="cmeta" data-badge="1" data-area="${escapeHtml(item.key)}">—</div>
        `;
        children.appendChild(child);
      });
      tree.appendChild(node);
    });

    updateContentsBadges();
  }

  function bindContents() {
    document.querySelectorAll(".nodehdr").forEach((hdr) => {
      hdr.addEventListener("click", () => {
        const node = hdr.closest(".node");
        const caret = node.querySelector(".caret");
        const children = node.querySelector(".children");

        const isHidden = children.classList.contains("hidden");
        if (isHidden) {
          children.classList.remove("hidden");
          caret.textContent = "▾";
        } else {
          children.classList.add("hidden");
          caret.textContent = "▸";
        }
      });
    });

    document.querySelectorAll(".child[data-area]").forEach((ch) => {
      ch.addEventListener("click", (e) => {
        e.stopPropagation();
        setActiveArea(ch.getAttribute("data-area"));
      });
    });

    const filter = $("filter");
    if (filter) {
      filter.addEventListener("input", () => {
        const q = (filter.value || "").trim().toLowerCase();
        document.querySelectorAll(".node").forEach((node) => {
          const sectionText = (node.querySelector(".nodetitle")?.textContent || "").toLowerCase();
          const children = [...node.querySelectorAll(".child")];
          const childMatch = children.some((c) => (c.textContent || "").toLowerCase().includes(q));
          const sectionMatch = sectionText.includes(q);

          node.style.display = (!q || sectionMatch || childMatch) ? "" : "none";
          children.forEach((c) => {
            c.style.display = (!q || (c.textContent || "").toLowerCase().includes(q)) ? "" : "none";
          });
        });
      });
    }
  }

  function setActiveArea(areaKey) {
    state.activeAreaKey = areaKey;
    document.querySelectorAll(".child[data-area]").forEach((el) => {
      el.classList.toggle("active", el.getAttribute("data-area") === areaKey);
    });
    renderAll();
  }

  // -------------------------
  // Dashboard
  // -------------------------
  function renderDashboard() {
    const wrap = $("dashTable");
    if (!wrap) return;

    const overall = getOverallCompletion();
    const meta = $("dashMeta");
    if (meta) meta.textContent = `Overall completion: ${overall.pct}% (${overall.completed}/${overall.total})`;

    const rows = Object.keys(PROGRAM || {}).map((areaKey) => {
      const title = PROGRAM[areaKey]?.title || areaKey;
      const c = getAreaCompletion(areaKey);
      const st = areaStatus(areaKey);
      return { areaKey, title, pct: c.pct, completed: c.completed, total: c.total, status: st };
    });

    let html = `<table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #e6e9ef;">Area</th>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #e6e9ef; width:140px;">Completion</th>
          <th style="text-align:left; padding:8px; border-bottom:1px solid #e6e9ef; width:160px;">Status</th>
        </tr>
      </thead><tbody>`;

    rows.forEach((r) => {
      html += `<tr>
        <td style="padding:8px; border-bottom:1px solid #f0f2f6;">
          <b>${escapeHtml(r.title)}</b> <span class="small">(${escapeHtml(r.areaKey)})</span>
        </td>
        <td style="padding:8px; border-bottom:1px solid #f0f2f6;">
          ${escapeHtml(r.pct)}% <span class="small">(${escapeHtml(r.completed)}/${escapeHtml(r.total)})</span>
        </td>
        <td style="padding:8px; border-bottom:1px solid #f0f2f6;">${escapeHtml(r.status)}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    wrap.innerHTML = html;
  }

  // -------------------------
  // Export (PDF via print) includes procedure comments
  // -------------------------
  function printWorkingPaper() {
    const dt = new Date();
    const stamp = fmtDateTime(dt);

    const eng = state.engagements.find((x) => x.id === state.engagementId) || {};
    const overall = getOverallCompletion();

    const css = `
      body{font-family:"Times New Roman", Times, serif; color:#0b1220; margin:24px;}
      h1{margin:0 0 4px; font-size:18px;}
      .meta{margin:0 0 18px; color:#5b6472; font-weight:700; font-size:12.5px;}
      h2{margin:18px 0 8px; font-size:15px;}
      h3{margin:14px 0 6px; font-size:13.5px; color:#0b1220;}
      table{width:100%; border-collapse:collapse; margin:8px 0 14px;}
      th,td{border:1px solid #e6e9ef; padding:8px; vertical-align:top; font-size:12.5px;}
      th{background:#f7fafb; text-align:left;}
      .small{color:#5b6472;}
      .tag{display:inline-block; padding:2px 8px; border:1px solid #e6e9ef; border-radius:999px; font-weight:700; font-size:12px; color:#5b6472;}
      .box{border:1px solid #e6e9ef; border-radius:10px; padding:8px; margin-top:6px;}
      .line{border-top:1px solid #f0f2f6; margin-top:6px; padding-top:6px;}
      @media print{ .noprint{display:none;} }
    `;

    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Audit Working Paper</title><style>${css}</style></head><body>`;
    html += `<h1>Audit Program – Working Paper</h1>`;
    html += `<div class="meta">
      Engagement: ${escapeHtml(eng.client_name || "")} <span class="small">(${escapeHtml(state.engagementId || "")})</span>
      · YE: ${escapeHtml(fmtDate(eng.year_end || ""))}
      · User: ${escapeHtml(state.user.username)} (${escapeHtml(state.user.role)})
      · Generated: ${escapeHtml(stamp)}
      · Total completion: ${escapeHtml(overall.pct)}% (${escapeHtml(overall.completed)}/${escapeHtml(overall.total)})
    </div>`;
    html += `<div class="noprint" style="margin-bottom:14px;"><button onclick="window.print()">Print / Save as PDF</button></div>`;

    Object.keys(PROGRAM || {}).forEach((areaKey) => {
      const area = PROGRAM[areaKey];
      const so = ensureAreaSignoff(areaKey);
      const status = areaStatus(areaKey);

      html += `<h2>${escapeHtml(area?.title || areaKey)} <span class="tag">${escapeHtml(areaKey)}</span></h2>`;
      html += `<div class="small">Area status: <b>${escapeHtml(status)}</b> · Completion: <b>${escapeHtml(getAreaCompletion(areaKey).pct)}%</b></div>`;

      if (so.prepared) html += `<div class="small">Prepared: ${escapeHtml(so.prepared.by)} @ ${escapeHtml(fmtDateTime(so.prepared.at))}</div>`;
      if (so.reviewed) html += `<div class="small">Reviewed: ${escapeHtml(so.reviewed.by)} @ ${escapeHtml(fmtDateTime(so.reviewed.at))}</div>`;
      if (so.signedOff) html += `<div class="small">Signed off: ${escapeHtml(so.signedOff.by)} @ ${escapeHtml(fmtDateTime(so.signedOff.at))}</div>`;
      if (so.na) html += `<div class="small">N/A: ${escapeHtml(so.na.by)} @ ${escapeHtml(fmtDateTime(so.na.at))}</div>`;

      PHASES.forEach((phase) => {
        const list = area?.procedures?.[phase] || [];
        const phaseResponses = ensurePhaseResponses(areaKey, phase);

        html += `<h3>${escapeHtml(phase)}</h3>`;
        if (!list.length) {
          html += `<div class="small">No procedures defined for this phase.</div>`;
          return;
        }

        html += `<table><thead><tr><th style="width:40px;">#</th><th>Procedure</th><th style="width:90px;">Status</th><th style="width:200px;">Last update</th></tr></thead><tbody>`;
        list.forEach((p, idx) => {
          const pid = getProcedureId(areaKey, phase, p, idx);
          const r = phaseResponses[pid] || {};
          const last = r.updated_at ? fmtDateTime(r.updated_at) : "";
          const by = r.updated_by ? whoName(r.updated_by) : "";
          const comments = getProcedureComments(areaKey, phase, pid);

          html += `<tr>
            <td>${idx + 1}</td>
            <td>
              <div><b>${escapeHtml(p?.heading || "")}</b></div>
              <div>${escapeHtml(p?.text || "")}</div>
              <div class="small">ID: ${escapeHtml(pid)}</div>
              ${comments.length ? `
                <div class="box">
                  <div style="font-weight:700;">Procedure comments (${comments.length})</div>
                  ${comments.map((c) => {
                    const cWhen = c.created_at ? fmtDateTime(c.created_at) : "";
                    const cBy = c.created_by ? whoName(c.created_by) : "";
                    return `<div class="line">
                      <div class="small"><b>${escapeHtml(cBy)}</b> · ${escapeHtml(cWhen)}</div>
                      <div style="white-space:pre-wrap;">${escapeHtml(c.text)}</div>
                    </div>`;
                  }).join("")}
                </div>` : ""}
            </td>
            <td>${escapeHtml((r?.status || "").toUpperCase())}</td>
            <td>${escapeHtml(last)}${by ? `<div class="small">By: ${escapeHtml(by)}</div>` : ""}</td>
          </tr>`;
        });
        html += `</tbody></table>`;
      });
    });

    html += `</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    w.addEventListener("load", () => { try { w.print(); } catch {} });
  }

  // -------------------------
  // Engagement UI
  // -------------------------
  async function refreshEngagementsUI() {
    const list = await sbListMyEngagements();
    state.engagements = list;

    const sel = $("selEngagement");
    if (!sel) return;
    sel.innerHTML = "";
    list.forEach((e) => {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = `${e.client_name}${e.year_end ? " · YE: " + fmtDate(e.year_end) : ""}`;
      sel.appendChild(opt);
    });

    if (!state.engagementId && list[0]) state.engagementId = list[0].id;
    if (state.engagementId) sel.value = state.engagementId;
  }

  async function switchEngagement(engagementId) {
    if (!engagementId || engagementId === state.engagementId) return;
    await flushNow().catch(() => {});
    state.engagementId = engagementId;
    await sbLoadEngagementData(engagementId);
    rtStart(engagementId);
    renderAll();
  }

  async function createEngagementFromModal() {
    if (!state.user) return;

    const client_name = ($("newEngClient").value || "").trim();
    const year_end = ($("newEngYearEnd").value || "").trim();
    const expected_completion_date = ($("newEngExpected").value || "").trim();

    if (!client_name || !year_end) {
      window.alert("Client name and Year End are required.");
      return;
    }

    if (!roleAtLeast(state.user.role, "Reviewer")) {
      window.alert("Only Reviewer/Partner can create engagements.");
      return;
    }

    try {
      const eng = await sbCreateEngagement({ client_name, year_end, expected_completion_date });
      await refreshEngagementsUI();
      const sel = $("selEngagement");
      if (sel) sel.value = eng.id;
      await sbLoadEngagementData(eng.id);
      rtStart(eng.id);
      renderAll();

      $("newEngClient").value = "";
      $("newEngYearEnd").value = "";
      $("newEngExpected").value = "";
    } catch (e) {
      console.error(e);
      window.alert(e?.message || "Could not create engagement. Check Supabase policies.");
    }
  }

  // -------------------------
  // Modals
  // -------------------------
  function openModal(id) { const m = $(id); if (m) m.classList.add("show"); }
  function closeModal(id) { const m = $(id); if (m) m.classList.remove("show"); }

  // -------------------------
  // Login / Logout
  // -------------------------
  function showLogin() {
    $("loginModal")?.classList.add("show");
    $("appShell")?.classList.add("hidden");
    if ($("loginError")) $("loginError").textContent = "";
  }

  function showApp() {
    $("loginModal")?.classList.remove("show");
    $("appShell")?.classList.remove("hidden");
  }

  async function doLogin() {
    try {
      assertSupabaseReady();
      const email = ($("loginUser").value || "").trim();
      const password = ($("loginPass").value || "").trim();
      if (!email || !password) {
        if ($("loginError")) $("loginError").textContent = "Please enter email and password.";
        return;
      }

      const user = await sbSignIn(email, password);
      const profile = await sbEnsureProfile(user);

      state.user = { id: user.id, email: user.email, username: profile.username, role: profile.role };
      cacheProfiles([profile]);

      if ($("pillUser")) $("pillUser").textContent = `User: ${state.user.username}`;
      if ($("pillRole")) $("pillRole").textContent = `Role: ${state.user.role}`;
      if ($("badgeMode")) $("badgeMode").textContent = "Online";

      await refreshEngagementsUI();
      if (state.engagementId) {
        await sbLoadEngagementData(state.engagementId);
        rtStart(state.engagementId);
      }

      showApp();
      renderAll();
      renderDashboard();
    } catch (e) {
      console.error(e);
      if ($("loginError")) $("loginError").textContent = e?.message || "Login failed.";
    }
  }

  async function doLogout() {
    try { await flushNow(); } catch {}
    try { rtStop(); } catch {}
    try { await sbSignOut(); } catch {}
    state.user = null;
    state.engagements = [];
    state.engagementId = null;
    state.responses = {};
    state.signoff = {};
    state.procedureComments = {};
    showLogin();
  }

  // -------------------------
  // Bind UI
  // -------------------------
  function bindUI() {
    $("btnLogin")?.addEventListener("click", doLogin);
    $("loginPass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

    $("btnLogout")?.addEventListener("click", doLogout);

    $("btnExport")?.addEventListener("click", () => openModal("exportModal"));
    $("exportPdf")?.addEventListener("click", () => { flushNow().then(printWorkingPaper); closeModal("exportModal"); });
    $("cancelExport")?.addEventListener("click", () => closeModal("exportModal"));
    $("closeExport")?.addEventListener("click", () => closeModal("exportModal"));

    $("btnDashboard")?.addEventListener("click", () => { renderDashboard(); openModal("dashboardModal"); });
    $("btnCloseDashboard2")?.addEventListener("click", () => closeModal("dashboardModal"));
    $("closeDashboard")?.addEventListener("click", () => closeModal("dashboardModal"));

    $("btnCreateEngagement")?.addEventListener("click", createEngagementFromModal);

    const sel = $("selEngagement");
    if (sel) sel.addEventListener("change", async () => { await switchEngagement(sel.value); });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activePhase = tab.getAttribute("data-phase");
        renderAll();
      });
    });

    $("chkPrepared")?.addEventListener("change", onPreparedToggle);
    $("chkReviewed")?.addEventListener("change", onReviewedToggle);
    $("chkSignedOff")?.addEventListener("change", onSignedOffToggle);
    $("chkNotApplicable")?.addEventListener("change", onNAToggle);
  }

  function renderAll() {
    renderTabs();
    renderAreaHeader();
    renderSteps();
    renderSignoff();
    updateProgress();
    updateContentsBadges();
  }

  // -------------------------
  // Init
  // -------------------------
  function init() {
    showLogin();
    ensureCommentModal();
    ensureSyncErrorSlot();
    buildContentsTree();
    bindContents();
    bindUI();
    setActiveArea(state.activeAreaKey);
    renderAll();
  }

  init();
})();
