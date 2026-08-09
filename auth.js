const authMessage = document.getElementById("authMessage");
const client = window.tarSupabase;

function showMessage(text, type="error"){
  authMessage.textContent = text;
  authMessage.className = `auth-message show ${type}`;
}

if (!client) {
  showMessage("Supabase is not connected yet. Add your Project URL and Publishable Key to supabase-config.js.");
}

document.getElementById("signupForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!client) return;

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/login.html`
    }
  });

  if (error) return showMessage(error.message, "error");

  if (data.session) {
    showMessage("Account created successfully. Redirecting…", "success");
    setTimeout(() => location.href = "account.html", 900);
  } else {
    showMessage("Account created. Check your email to confirm your address, then log in.", "success");
  }
});

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!client) return;

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) return showMessage(error.message, "error");

  showMessage("Login successful. Redirecting…", "success");
  setTimeout(() => location.href = "account.html", 650);
});
