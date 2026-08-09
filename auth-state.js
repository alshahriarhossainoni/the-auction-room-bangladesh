document.addEventListener("DOMContentLoaded", async () => {
  const client = window.tarSupabase;
  if (!client) return;

  const { data } = await client.auth.getSession();
  renderAuthState(data?.session);

  client.auth.onAuthStateChange((_event, session) => {
    renderAuthState(session);
  });

  function renderAuthState(session) {
    const navTools = document.querySelector(".nav-tools");
    if (!navTools) return;

    navTools.querySelector(".user-menu")?.remove();

    const login = navTools.querySelector(".login-link");
    const signup = navTools.querySelector(".signup-link");

    if (!session?.user) {
      if (login) login.style.display = "";
      if (signup) signup.style.display = "";
      return;
    }

    if (login) login.style.display = "none";
    if (signup) signup.style.display = "none";

    const wrap = document.createElement("div");
    wrap.className = "user-menu";
    wrap.innerHTML = `
      <a class="user-chip" href="account.html">${session.user.email || "My Account"}</a>
      <button class="logout-btn" type="button">Log Out</button>
    `;
    navTools.appendChild(wrap);

    wrap.querySelector(".logout-btn").addEventListener("click", async () => {
      await client.auth.signOut();
      window.location.href = "index.html";
    });
  }
});
