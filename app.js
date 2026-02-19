// app.js — Dashboard + Auth (FIXED VERSION)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =============================
// SUPABASE CONFIG (YOUR KEYS)
// =============================
const SUPABASE_URL = "https://syfnepulwwzwcfwjruwn.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5Zm5lcHVsd3d6d2Nmd2pydXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDQ4MjAsImV4cCI6MjA4Njk4MDgyMH0.JhjdCtj-ezy9tsA4kz1QmR3mk71kVyucs8v7OlcGEIk";

// FORCE SESSION PERSISTENCE
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

function showApp(on) {
  $("appShell")?.classList.toggle("hidden", !on);
  $("loginModal")?.classList.toggle("show", !on);
}

// =============================
// AUTH
// =============================
async function login(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  console.log("LOGIN RESULT:", data, error);

  if (error) throw error;
  if (!data?.session) throw new Error("No session returned from login.");

  return data.session;
}

async function logout() {
  await sb.auth.signOut();
  location.reload();
}

// =============================
// CLIENT CRUD
// =============================
async function createClientRecord(name) {
  const { data: userData } = await sb.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) throw new Error("Not authenticated.");

  const { data, error } = await sb
    .from("clients")
    .insert({
      name,
      created_by: userId
    })
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

// =============================
// ENGAGEMENT CRUD
// =============================
async function createEngagementRecord(client_id, name, year_end) {
  const { data: userData } = await sb.auth.getUser();
  const userId = userData?.user?.id;

  if (!userId) throw new Error("Not authenticated.");

  const { data, error } = await sb
    .from("engagements")
    .insert({
      client_id,
      name,
      year_end,
      created_by: userId
    })
    .select("id,client_id,name,year_end")
    .single();

  if (error) throw error;
  return data;
}

// =============================
// INIT
// =============================
async function init() {

  // CHECK EXISTING SESSION
  const { data } = await sb.auth.getSession();

  console.log("SESSION ON LOAD:", data?.session);

  if (data?.session) {
    showApp(true);
  } else {
    showApp(false);
  }

  // LOGIN BUTTON
  $("btnLogin")?.addEventListener("click", async () => {
    const email = $("loginUser").value.trim();
    const pass = $("loginPass").value;

    try {
      await login(email, pass);
      showApp(true);
    } catch (e) {
      $("loginError").textContent = e.message;
    }
  });

  // LOGOUT
  $("btnLogout")?.addEventListener("click", logout);

  // CREATE CLIENT
  $("btnCreateClient")?.addEventListener("click", async () => {
    const name = $("newClientName").value.trim();
    if (!name) return;

    try {
      await createClientRecord(name);
      alert("Client created successfully.");
      location.reload();
    } catch (e) {
      alert(e.message);
    }
  });

  // CREATE ENGAGEMENT
  $("btnCreateEng")?.addEventListener("click", async () => {
    const client_id = $("engClient").value;
    const year_end = $("engYearEnd").value;
    const name = $("engName").value;

    try {
      await createEngagementRecord(client_id, name, year_end);
      alert("Engagement created successfully.");
      location.reload();
    } catch (e) {
      alert(e.message);
    }
  });
}

init();
