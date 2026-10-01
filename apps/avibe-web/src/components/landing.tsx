"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const castingSkill =
  "https://github.com/wuyinhust/vibe-casting/tree/main/skills/avibe-casting";
const vibeSkill =
  "https://github.com/wuyinhust/vibe-casting/tree/main/skills/vibe-casting";

export function Landing() {
  const [locale, setLocale] = useState<"zh" | "en">("zh");
  const t = (zh: string, en: string) => (locale === "zh" ? zh : en);

  useEffect(() => {
    const saved =
      localStorage.getItem("avibe-locale") ??
      localStorage.getItem("avibe-preview-language");
    if (saved === "en") setLocale("en");
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
    document.title =
      locale === "en"
        ? "avibe — Cast your next story"
        : "avibe — 为你的故事选角";
    localStorage.setItem("avibe-locale", locale);
  }, [locale]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="avibe home">
          avibe<span>✳</span>
        </a>
        <div className="brand-caption">A NEW CAST OF POSSIBILITIES</div>
        <nav aria-label="Main navigation">
          <a className="nav-link active" href="#top">
            {t("项目介绍", "Introduction")}
          </a>
          <a className="nav-link" href="#approach">
            {t("选角方式", "How it works")}
          </a>
          <a className="nav-link" href="#skill">
            {t("开源 Skill", "Open-source Skill")}
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="skill-promo">
            <strong>
              {t("把角色带进你的工作流", "Cast inside your workflow")}
            </strong>
            <p>
              {t(
                "AVIBE 选角 Skill 已开源，可查看角色包格式、授权信息和调用方式。",
                "The AVIBE casting Skill is open source, with character-package and rights documentation.",
              )}
            </p>
            <a href={castingSkill} target="_blank" rel="noopener noreferrer">
              {t("查看 Skill ↗", "Explore the Skill ↗")}
            </a>
          </div>
          <div className="sidebar-footer">
            <span>© avibe 2026</span>
            <span>avibe.net</span>
          </div>
        </div>
      </aside>
      <main className="main" id="top">
        <header className="topbar">
          <a className="mobile-brand" href="#top">
            avibe<span>✳</span>
          </a>
          <span className="top-caption">
            {t("一个角色，更多故事。", "One character. More stories.")}
          </span>
          <button
            className="language-button"
            type="button"
            aria-label="Switch language"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          >
            {locale === "zh" ? "EN" : "中文"}
          </button>
        </header>
        <div className="page-content">
          <div className="preview-status" role="status">
            <span className="status-dot" />
            <span>
              {t(
                "公开预览 · 角色库与创作服务筹备中",
                "Public preview · Casting catalog and creation services are in preparation",
              )}
            </span>
          </div>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="live-dot" />
                <span>
                  {t("为想象，找到主角", "YOUR STORY. THEIR NEXT CHAPTER.")}
                </span>
              </div>
              <h1 id="hero-title">
                {t(
                  "找到，让故事发生的人。",
                  "Find the face of your next story.",
                )}
              </h1>
              <p>
                {t(
                  "AVIBE 正在打造面向 AI 视频创作者的选角平台：以清晰的人设、可追溯的版本和明确的使用授权，让同一个角色走进更多作品。",
                  "AVIBE is building a casting platform for AI video creators, with defined personas, traceable versions, and clear usage rights so a character can live across stories.",
                )}
              </p>
              <div className="hero-actions">
                <Link className="primary" href="/discover">
                  {t("发现角色 ↗", "Discover characters ↗")}
                </Link>
                <a className="secondary" href="#approach">
                  {t("了解 AVIBE", "Explore AVIBE")}
                </a>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <span className="art-mark">✳</span>
              <span className="art-caption">
                A NEW CAST
                <br />
                OF POSSIBILITIES
              </span>
            </div>
          </section>
          <section
            className="intro"
            id="approach"
            aria-labelledby="approach-title"
          >
            <div className="section-kicker">THE AVIBE APPROACH</div>
            <h2 id="approach-title">
              {t("选角，不止看一张图。", "Casting goes beyond one image.")}
            </h2>
            <p>
              {t(
                "角色的身份、形象与使用权应当一起被理解。AVIBE 将这些信息组织成可核验的角色资产，而不是只展示一张封面。",
                "A character's identity, appearance, and usage rights belong together. AVIBE organizes them as verifiable assets rather than a single cover image.",
              )}
            </p>
            <div className="feature-grid">
              <article className="feature">
                <span className="feature-number">01 / DISCOVER</span>
                <div className="feature-symbol">◌</div>
                <h3>{t("发现合适的角色", "Discover the right cast")}</h3>
                <p>
                  {t(
                    "根据人物设定、内容场景与授权要求寻找候选。角色库正在筹备中。",
                    "Find candidates by persona, story context, and rights. The catalog is in preparation.",
                  )}
                </p>
              </article>
              <article className="feature">
                <span className="feature-number">02 / VERIFY</span>
                <div className="feature-symbol">◎</div>
                <h3>{t("看清版本与授权", "Understand versions and rights")}</h3>
                <p>
                  {t(
                    "将身份、造型、资产文件和许可记录对应到明确的版本。",
                    "Connect identity, looks, asset files, and license records to defined versions.",
                  )}
                </p>
              </article>
              <article className="feature">
                <span className="feature-number">03 / CREATE</span>
                <div className="feature-symbol">✳</div>
                <h3>
                  {t("让角色继续创作", "Keep the character in the story")}
                </h3>
                <p>
                  {t(
                    "角色资产与创作流程正在联调；账号、下载与生成暂未开放。",
                    "Asset and creation services are being connected. Sign-in, downloads, and generation are not yet available.",
                  )}
                </p>
              </article>
            </div>
          </section>
          <section
            className="skill-section"
            id="skill"
            aria-labelledby="skill-title"
          >
            <div>
              <div className="section-kicker">OPEN SOURCE · AVIBE CASTING</div>
              <h2 id="skill-title">
                {t(
                  "把选角方法带进工作流。",
                  "Bring casting into your workflow.",
                )}
              </h2>
              <p>
                {t(
                  "先从开源 Skill 了解角色检索、角色包与授权边界。原 Vibe Casting 创作方法也保留在同一个仓库。",
                  "Explore the open-source Skill for discovery, character packages, and rights. The original Vibe Casting method remains in the same repository.",
                )}
              </p>
            </div>
            <div className="skill-links">
              <a
                className="primary"
                href={castingSkill}
                target="_blank"
                rel="noopener noreferrer"
              >
                AVIBE Casting Skill ↗
              </a>
              <a
                className="secondary"
                href={vibeSkill}
                target="_blank"
                rel="noopener noreferrer"
              >
                Vibe Casting Skill ↗
              </a>
            </div>
          </section>
          <footer className="footer">
            <span>avibe ✳</span>
            <span>
              {t(
                "公开预览 · 功能开放以正式公告为准",
                "Public preview · Features will be announced when available",
              )}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
