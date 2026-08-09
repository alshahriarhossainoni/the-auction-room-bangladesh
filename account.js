document.addEventListener("DOMContentLoaded", async () => {
  const client = window.tarSupabase;
  const status = document.getElementById("accountStatus");

  if (!client) {
    status.textContent = "Supabase is not connected yet.";
    return;
  }

  const { data } = await client.auth.getSession();
  const session = data?.session;
  const user = session?.user;

  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const fullName = user.user_metadata?.full_name || "Trader";
  const email = user.email || "";
  const joined = user.created_at ? new Date(user.created_at) : null;

  document.getElementById("dashboardName").textContent = fullName;
  status.textContent = "Your authenticated TAR Bangladesh member area.";

  document.getElementById("accountDetails").innerHTML = `
    <div><span>Name</span><strong>${escapeHtml(fullName)}</strong></div>
    <div><span>Email</span><strong>${escapeHtml(email)}</strong></div>
    <div><span>Status</span><strong>Authenticated</strong></div>
  `;

  document.getElementById("emailVerification").textContent =
    user.email_confirmed_at ? "Verified" : "Pending";

  document.getElementById("accountId").textContent =
    user.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : "—";

  document.getElementById("joinedDate").textContent =
    joined ? joined.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }) : "—";

  const pill = document.getElementById("memberPill");
  pill.textContent = user.email_confirmed_at ? "Verified Member" : "Email Pending";
  if (!user.email_confirmed_at) pill.classList.add("pending");

  const logout = async () => {
    await client.auth.signOut();
    window.location.href = "index.html";
  };

  document.getElementById("accountLogout")?.addEventListener("click", logout);
  document.getElementById("accountLogoutSide")?.addEventListener("click", logout);

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    })[ch]);
  }
});
