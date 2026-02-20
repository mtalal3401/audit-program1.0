import { sb } from "./supabase.js";

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const appDiv = document.getElementById("app");

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  if (data.session) {
    appDiv.style.display = "block";
    alert("Login successful");
  }
});

logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  appDiv.style.display = "none";
});
