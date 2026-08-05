// The Auction Room Bangladesh — Main Website Script

document.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const revealElements = document.querySelectorAll(".reveal");

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, revealObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -30px 0px",
      }
    );

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("visible"));
  }

  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  fetch("market-data.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Market data request failed: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      setText("instrument", data.instrument);
      setText("date", data.date);
      setText("callResistance", data.callResistance);
      setText("putSupport", data.putSupport);
      setText("gammaWall", data.gammaWall);
      setText("hvl", data.hvl);
      setText("weeklyOutlook", data.weeklyOutlook);

      const biasElement = document.getElementById("bias");

      if (biasElement) {
        const biasText = String(data.bias || "Neutral");
        const normalizedBias = biasText.trim().toLowerCase();

        biasElement.textContent = biasText;
        biasElement.classList.remove("positive", "negative", "neutral", "flip");

        if (normalizedBias.includes("positive")) {
          biasElement.classList.add("positive");
        } else if (normalizedBias.includes("negative")) {
          biasElement.classList.add("negative");
        } else if (normalizedBias.includes("flip")) {
          biasElement.classList.add("flip");
        } else {
          biasElement.classList.add("neutral");
        }
      }
    })
    .catch((error) => {
      console.error("Unable to load market-data.json:", error);
    });
});

function setText(id, value) {
  const element = document.getElementById(id);

  if (element && value !== undefined && value !== null) {
    element.textContent = value;
  }
}
