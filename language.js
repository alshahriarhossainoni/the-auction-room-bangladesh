const TAR_TRANSLATIONS = {
  en: {
    joinCommunity: "Join Community",
    login: "Log In",
    signup: "Sign Up",
    heroEyebrow: "Auction Market Theory • Order Flow • Options Context",
    heroLine1: "Read the market.",
    heroLine2: "Not the noise.",
    heroText: "A structured market education platform for Bangla-speaking traders who want to understand auction behavior, real participation and professional execution.",
    startFreeCourse: "Start Free Course",
    explorePremium: "Explore Premium Batch",
    ourMission: "Our Mission",
    missionTitle: "Professional market education, built for Bangla-speaking traders.",
    learningPaths: "Learning Paths",
    learningTitle: "Start free. Advance with structured mentorship.",
    officialCommunity: "Official Community",
    communityTitle: "Learn, discuss and grow with TAR Bangladesh."
  },
  bn: {
    joinCommunity: "কমিউনিটিতে যোগ দিন",
    login: "লগ ইন",
    signup: "সাইন আপ",
    heroEyebrow: "অকশন মার্কেট থিওরি • অর্ডার ফ্লো • অপশনস কনটেক্সট",
    heroLine1: "মার্কেট পড়ুন।",
    heroLine2: "নয়েজ নয়।",
    heroText: "বাংলাভাষী ট্রেডারদের জন্য একটি স্ট্রাকচার্ড মার্কেট এডুকেশন প্ল্যাটফর্ম—যেখানে শেখানো হয় অকশন বিহেভিয়ার, রিয়েল পার্টিসিপেশন এবং প্রফেশনাল এক্সিকিউশন।",
    startFreeCourse: "ফ্রি কোর্স শুরু করুন",
    explorePremium: "প্রিমিয়াম ব্যাচ দেখুন",
    ourMission: "আমাদের লক্ষ্য",
    missionTitle: "বাংলাভাষী ট্রেডারদের জন্য প্রফেশনাল মার্কেট এডুকেশন।",
    learningPaths: "লার্নিং পাথ",
    learningTitle: "ফ্রি দিয়ে শুরু করুন। স্ট্রাকচার্ড মেন্টরশিপে এগিয়ে যান।",
    officialCommunity: "অফিশিয়াল কমিউনিটি",
    communityTitle: "TAR Bangladesh-এর সাথে শিখুন, আলোচনা করুন এবং এগিয়ে যান।"
  }
};

(function(){
  const button = document.getElementById("languageButton");
  const menu = document.getElementById("languageMenu");

  function applyLanguage(lang){
    const dict = TAR_TRANSLATIONS[lang] || TAR_TRANSLATIONS.en;
    document.documentElement.lang = lang === "bn" ? "bn" : "en";
    localStorage.setItem("tarLanguage", lang);

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });

    if (button) button.textContent = lang === "bn" ? "🌐 বাংলা⌄" : "🌐 EN⌄";
    menu?.classList.remove("open");
    button?.setAttribute("aria-expanded","false");
  }

  button?.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    button.setAttribute("aria-expanded", String(open));
  });

  menu?.querySelectorAll("[data-language]").forEach(item => {
    item.addEventListener("click", () => applyLanguage(item.dataset.language));
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".language-switcher")) {
      menu?.classList.remove("open");
      button?.setAttribute("aria-expanded","false");
    }
  });

  applyLanguage(localStorage.getItem("tarLanguage") || "en");
})();
