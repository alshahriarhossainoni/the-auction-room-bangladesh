document.addEventListener("DOMContentLoaded", async () => {
  const client = window.tarSupabase;
  const status = document.getElementById("accountStatus");

  if (!client) {
    status.textContent = "Supabase is not connected yet.";
    return;
  }

  const { data: sessionData } = await client.auth.getSession();
  const session = sessionData?.session;
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

  // Load role/access flags from public.profiles.
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role, free_course, premium_access, copy_trading_access")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "member";
  const freeAccess = profile?.free_course ?? true;
  const premiumAccess = profile?.premium_access ?? false;
  const copyAccess = profile?.copy_trading_access ?? false;

  const roleLabel = {
    member: "Member",
    premium: "Premium Member",
    staff: "Staff",
    admin: "Administrator"
  }[role] || "Member";

  document.getElementById("accountDetails").innerHTML = `
    <div><span>Name</span><strong>${escapeHtml(fullName)}</strong></div>
    <div><span>Email</span><strong>${escapeHtml(email)}</strong></div>
    <div><span>Role</span><strong>${escapeHtml(roleLabel)}</strong></div>
  `;

  const pill = document.getElementById("memberPill");
  pill.textContent = roleLabel;
  pill.classList.remove("pending");

  const studentStatus = document.getElementById("studentStatus");
  studentStatus.textContent = roleLabel;

  if (profileError) {
    studentStatus.textContent = "Member";
    console.warn("Could not load profile access:", profileError.message);
  }

  // Free course access
  const freeStatus = document.getElementById("freeCourseStatus");
  const freeLink = document.getElementById("freeCourseLink");
  freeStatus.textContent = freeAccess ? "Available" : "Restricted";
  freeStatus.className = freeAccess ? "access-open" : "access-pending";
  if (!freeAccess) {
    freeLink.textContent = "Access Restricted";
    freeLink.removeAttribute("href");
    freeLink.classList.add("disabled-link");
  }

  // Premium access
  const premiumStatus = document.getElementById("premiumStatus");
  const premiumLink = document.getElementById("premiumLink");
  premiumStatus.textContent = premiumAccess ? "Premium Access Active" : "Application Based";
  premiumStatus.className = premiumAccess ? "access-open" : "access-pending";
  premiumLink.textContent = premiumAccess ? "Open Premium ↗" : "View Premium ↗";
  premiumLink.href = "premium.html";

  // Copy trading access
  const copyLink = document.getElementById("copyTradingLink");
  if (copyAccess) {
    copyLink.textContent = "Open GTCFX Account ↗";
    copyLink.classList.remove("restricted");
  } else {
    copyLink.textContent = "Copy Trading Access Pending";
    copyLink.removeAttribute("href");
    copyLink.removeAttribute("target");
    copyLink.classList.add("restricted");
  }

  // Security/profile details
  document.getElementById("emailVerification").textContent =
    user.email_confirmed_at ? "Verified" : "Pending";

  document.getElementById("accountId").textContent =
    user.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : "—";

  document.getElementById("joinedDate").textContent =
    joined ? joined.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" }) : "—";

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
