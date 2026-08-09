document.addEventListener("DOMContentLoaded", async () => {
  const client = window.tarSupabase;
  const status = document.getElementById("accountStatus");
  const details = document.getElementById("accountDetails");

  if (!client) {
    status.textContent = "Supabase is not connected yet.";
    return;
  }

  const { data } = await client.auth.getSession();
  const user = data?.session?.user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  status.textContent = "You are signed in.";
  details.innerHTML = `
    <div class="form-group">
      <label>Name</label>
      <input value="${user.user_metadata?.full_name || ""}" disabled>
    </div>
    <div class="form-group">
      <label>Email</label>
      <input value="${user.email || ""}" disabled>
    </div>
  `;

  document.getElementById("accountLogout").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "index.html";
  });
});
