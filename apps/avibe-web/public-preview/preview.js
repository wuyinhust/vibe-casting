const languageButton = document.getElementById("language");
let language = localStorage.getItem("avibe-preview-language") === "en" ? "en" : "zh";

function renderLanguage() {
  document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  document.title = language === "en" ? "avibe — Cast your next story" : "avibe — 为你的故事选角";
  document.querySelectorAll("[data-zh][data-en]").forEach((element) => {
    element.textContent = element.dataset[language];
  });
  languageButton.textContent = language === "en" ? "中文" : "EN";
}

languageButton.addEventListener("click", () => {
  language = language === "zh" ? "en" : "zh";
  localStorage.setItem("avibe-preview-language", language);
  renderLanguage();
});
renderLanguage();
