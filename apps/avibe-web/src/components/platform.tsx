"use client";
import { AssetPassport } from "./passport";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Compass,
  LayoutGrid,
  Plus,
  MessageCircle,
  UserRound,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowRight,
  Heart,
  Bookmark,
  Check,
  ChevronDown,
  X,
  Sparkles,
  Download,
  ShieldCheck,
  Shirt,
  Layers,
  Globe,
  Code2,
  LogOut,
  Menu,
  Users,
  AlertCircle,
} from "lucide-react";
import {
  AppContext,
  Data,
  Locale,
  api,
  post,
  local,
  Portrait,
  Modal,
  Empty,
  Spinner,
  SectionHeading,
  ErrorBox,
  download,
  useApp,
} from "./ui";
import { Studio } from "./studio";
import { ProfileEditor } from "./profile-editor";
import { Boards, Messages, Account, Admin } from "./workspace";
export function Platform() {
  const [locale, setLocale] = useState<Locale>("zh"),
    [view, setView] = useState("discover"),
    [user, setUser] = useState<Data | null>(null),
    [cap, setCap] = useState<Data>({}),
    [wallet, setWallet] = useState<Data | null>(null),
    [login, setLogin] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [q, setQ] = useState(""),
    [studioCharacter, setStudioCharacter] = useState<string | null>(null);
  const t = useCallback(
    (zh: string, en: string) => (locale === "zh" ? zh : en),
    [locale],
  );
  const notify = useCallback((m: string) => setToast(m), []);
  const refreshMe = useCallback(async () => {
    const d = await api("me");
    setUser(d.user);
    setCap(d.capabilities);
    setWallet(d.wallet);
  }, []);
  useEffect(() => {
    const stored = localStorage.getItem("avibe-locale");
    if (stored === "en") setLocale("en");
    const params = new URLSearchParams(location.search);
    if (params.get("character")) setSelected(params.get("character"));
    refreshMe().catch((e) => notify(e.message));
  }, [refreshMe, notify]);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    localStorage.setItem("avibe-locale", locale);
  }, [locale]);
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(tm);
  }, [toast]);
  const navigate = useCallback((v: string) => {
    setView(v);
    setSelected(null);
    if (v !== "studio") setStudioCharacter(null);
    window.history.replaceState({}, "", location.pathname);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const openCharacter = useCallback((id: string) => {
    setSelected(id);
    window.history.replaceState({}, "", `?character=${encodeURIComponent(id)}`);
  }, []);
  const closeCharacter = useCallback(() => {
    setSelected(null);
    window.history.replaceState({}, "", location.pathname);
  }, []);
  const requireLogin = useCallback(() => {
    if (user) return true;
    setLogin(true);
    return false;
  }, [user]);
  const ctx = useMemo(
    () => ({
      locale,
      t,
      user,
      cap,
      wallet,
      notify,
      requireLogin,
      refreshMe,
      navigate,
      openCharacter,
    }),
    [
      locale,
      t,
      user,
      cap,
      wallet,
      notify,
      requireLogin,
      refreshMe,
      navigate,
      openCharacter,
    ],
  );
  const nav = [
    ["discover", Compass, t("发现", "Discover")],
    ["boards", LayoutGrid, t("选角板", "Casting boards")],
    ["studio", Plus, t("创作工作室", "Create studio")],
    ["messages", MessageCircle, t("商务消息", "Messages")],
    ["account", UserRound, t("我的空间", "My space")],
  ] as const;
  return (
    <AppContext.Provider value={ctx}>
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => navigate("discover")}>
            avibe<span>✳</span>
          </button>
          <div className="brand-caption">A NEW CAST OF POSSIBILITIES</div>
          <nav>
            {nav.map(([id, Icon, label]) => (
              <button
                key={id}
                className={`nav-link ${view === id ? "active" : ""}`}
                onClick={() => navigate(id)}
                aria-current={view === id ? "page" : undefined}
              >
                <Icon size={22} strokeWidth={view === id ? 2.2 : 1.7} />
                <span>{label}</span>
                {id === "studio" && <span className="new-dot" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="skill-promo">
              <Code2 size={21} />
              <strong>
                {t("把角色带进你的工作流", "Cast inside your workflow")}
              </strong>
              <p>
                {t(
                  "开源 Skill，让灵感随时开场。",
                  "An open-source skill for your next story.",
                )}
              </p>
              <button onClick={() => navigate("skill")}>
                {t("探索 avibe Skill", "Explore avibe Skill")}
                <ArrowUpRight size={15} />
              </button>
            </div>
            {user ? (
              <button
                className="sidebar-profile"
                onClick={() => navigate("account")}
              >
                <span className="avatar">
                  {user.email.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{t("我的工作空间", "My workspace")}</strong>
                  <small>
                    {wallet
                      ? `${wallet.balance - wallet.held} ${t("可用积分", "credits available")}`
                      : ""}
                  </small>
                </span>
              </button>
            ) : (
              <button
                className="sidebar-profile"
                onClick={() => setLogin(true)}
              >
                <span className="avatar">
                  <UserRound size={19} />
                </span>
                <span>
                  <strong>
                    {t("登录你的创作空间", "Your creative space")}
                  </strong>
                  <small>
                    {t("让下一个故事从这里开始", "Your next story starts here")}
                  </small>
                </span>
              </button>
            )}
            <div className="sidebar-footer">
              <span>© avibe 2026</span>
              <span>
                {cap.demo ? t("本地演示", "Local demo") : "avibe.net"}
              </span>
            </div>
          </div>
        </aside>
        <main className="main">
          <header className="topbar">
            <div className="mobile-brand" onClick={() => navigate("discover")}>
              avibe✳
            </div>
            <div className="top-search">
              <Search size={19} />
              <input
                aria-label={t("搜索数字达人", "Search digital talent")}
                placeholder={t(
                  "试试「温柔的都市女主，适合生活方式内容」",
                  "Try “a thoughtful lead for a slice-of-life story”",
                )}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setView("discover");
                }}
              />
              {q ? (
                <button
                  className="icon-button"
                  onClick={() => setQ("")}
                  aria-label={t("清空搜索", "Clear search")}
                >
                  <X size={16} />
                </button>
              ) : (
                <kbd>⌕</kbd>
              )}
            </div>
            <div className="top-actions">
              <button
                className="language-button"
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                aria-label="Switch language"
              >
                <Globe size={16} />
                {locale === "zh" ? "EN" : "中文"}
              </button>
              <button
                className="primary create-top"
                onClick={() => navigate("studio")}
              >
                <Plus size={17} />
                {t("创建达人", "Create talent")}
              </button>
              <button
                className="round-profile"
                onClick={() => (user ? navigate("account") : setLogin(true))}
                aria-label={t("我的账号", "My account")}
              >
                {user ? (
                  user.email.slice(0, 1).toUpperCase()
                ) : (
                  <UserRound size={18} />
                )}
              </button>
            </div>
          </header>
          <div className="page-content">
            {view === "discover" ? (
              <Discover q={q} />
            ) : view === "studio" ? (
              <Studio initialCharacter={studioCharacter} />
            ) : view === "boards" ? (
              <Boards />
            ) : view === "messages" ? (
              <Messages />
            ) : view === "account" ? (
              <Account />
            ) : view === "admin" ? (
              <Admin />
            ) : (
              <SkillPage />
            )}
          </div>
        </main>
        <nav className="mobile-nav">
          {nav.map(([id, Icon, label]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => navigate(id)}
              aria-label={label}
            >
              <Icon size={21} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      {login && <Login onClose={() => setLogin(false)} />}{" "}
      {selected && (
        <CharacterDetail
          id={selected}
          onClose={closeCharacter}
          onTryOn={() => {
            setStudioCharacter(selected);
            setSelected(null);
            setView("studio");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function Discover({ q }: { q: string }) {
  const { t, locale, user, notify, requireLogin, openCharacter, navigate } =
    useApp();
  const [category, setCategory] = useState(""),
    [filterOpen, setFilterOpen] = useState(false),
    [gender, setGender] = useState(""),
    [purpose, setPurpose] = useState(""),
    [minAge, setMinAge] = useState(""),
    [maxAge, setMaxAge] = useState(""),
    [ready, setReady] = useState(false),
    [result, setResult] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [boardChar, setBoardChar] = useState<Data | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ q });
        if (category) params.set("category", category);
        if (gender) params.set("gender", gender);
        if (purpose) params.set("purpose", purpose);
        if (minAge) params.set("min_age", minAge);
        if (maxAge) params.set("max_age", maxAge);
        if (ready) params.set("ready", "true");
        api(`characters?${params}`, { signal: controller.signal })
          .then(setResult)
          .catch((e) => {
            if (e.name !== "AbortError") setError(e.message);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, category, gender, purpose, minAge, maxAge, ready, user]);
  const categories = [
    ["", t("为你发现", "For you")],
    ["urban", t("都市故事", "Urban stories")],
    ["lifestyle", t("生活方式", "Lifestyle")],
    ["historical", t("古装世界", "Period drama")],
    ["business", t("职场人物", "Professionals")],
    ["mature", t("成熟气质", "Mature talent")],
    ["natural", t("自然松弛", "Naturally effortless")],
  ];
  async function like(c: Data) {
    if (!requireLogin()) return;
    try {
      await post(`characters/${c.id}/like`, { liked: !c.liked });
      setResult((r) =>
        r
          ? {
              ...r,
              items: r.items.map((v: Data) =>
                v.id === c.id
                  ? {
                      ...v,
                      liked: !c.liked,
                      likes: v.likes + (c.liked ? -1 : 1),
                    }
                  : v,
              ),
            }
          : r,
      );
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            {t("为想象，找到主角", "YOUR STORY. THEIR NEXT CHAPTER.")}
          </div>
          <h1>
            {t("找到，让故事发生的人。", "Find the face of your")}
            <span className="english-hero">
              {locale === "en" ? "next story." : ""}
            </span>
          </h1>
          <p>
            {t(
              "发现独特的数字达人，从一个眼神开始你的下一个故事。",
              "Distinctive digital talent. Endless possibilities. It starts with a face.",
            )}
          </p>
          <div className="hero-meta">
            <span>
              <ShieldCheck size={15} />
              {t("清晰的角色授权", "Clear usage rights")}
            </span>
            <span>
              <Layers size={15} />
              {t("可复用的角色资产", "Production-ready assets")}
            </span>
            <button onClick={() => navigate("skill")}>
              {t("为 AI 创作者而生", "Built for AI creators")}
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="hero-note">
          <span className="handwritten">
            meet your
            <br />
            next muse.
          </span>
          <div className="note-arrow">↙</div>
          <div className="avatar-stack">
            {[0, 1, 2].map((i) => (
              <Portrait
                key={i}
                character={{
                  sprite_index: i,
                  cover: "/images/cast-editorial.png",
                }}
              />
            ))}
          </div>
          <small>{t("下一幕，由你定义。", "The next chapter is yours.")}</small>
        </div>
      </div>
      <div className="discovery-bar">
        <div className="category-tabs">
          {categories.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={category === id ? "selected" : ""}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={`filter-toggle ${filterOpen ? "selected" : ""}`}
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <SlidersHorizontal size={16} />
          {t("筛选", "Filters")}
          {(gender || purpose || ready || minAge || maxAge) && (
            <span className="filter-dot" />
          )}
        </button>
      </div>
      {filterOpen && (
        <div className="filter-panel">
          <label>
            {t("人物设定", "Character")}
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">{t("全部", "All")}</option>
              <option value="woman">{t("女性", "Women")}</option>
              <option value="man">{t("男性", "Men")}</option>
              <option value="nonbinary">{t("非二元", "Nonbinary")}</option>
            </select>
          </label>
          <label>
            {t("年龄从", "Age from")}
            <input
              type="number"
              min="1"
              max="110"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />
          </label>
          <label>
            {t("到", "To")}
            <input
              type="number"
              min="1"
              max="110"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
            />
          </label>
          <label>
            {t("使用用途", "Usage")}
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option value="">{t("全部授权类型", "All licenses")}</option>
              <option value="commercial">
                {t("允许商业内容", "Commercial content")}
              </option>
              <option value="brand">
                {t("允许品牌广告", "Brand advertising")}
              </option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={ready}
              onChange={(e) => setReady(e.target.checked)}
            />
            {t("仅完整角色包", "Complete packages only")}
          </label>
          <button
            className="text-button"
            onClick={() => {
              setGender("");
              setPurpose("");
              setMinAge("");
              setMaxAge("");
              setReady(false);
            }}
          >
            {t("重置", "Reset")}
          </button>
        </div>
      )}
      <div className="results-heading">
        <span>
          {q
            ? t("搜索结果", "Search results")
            : t(
                "灵感，从这里开始",
                "A little inspiration for your next big idea",
              )}
          <small>
            {result
              ? ` · ${result.total} ${t("位数字达人", "digital talents")}`
              : ""}
          </small>
        </span>
        <span className="sort-label">
          {q ? t("匹配优先", "Best match") : t("精选推荐", "Curated selection")}
          <ChevronDown size={14} />
        </span>
      </div>
      {q && result && (
        <div className="intent-note">
          <Sparkles size={15} />
          {t(
            "严格遵守年龄、授权和素材条件；气质按相关性排序。",
            "Age, license and asset requirements are strict. Personality is ranked by relevance.",
          )}
        </div>
      )}
      <ErrorBox message={error} />
      {loading ? (
        <div className="cast-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : result?.items.length ? (
        <div className="cast-grid">
          {result.items.map((c: Data, i: number) => (
            <article className={`cast-card card-${i % 4}`} key={c.id}>
              <div className="photo-wrap">
                <button
                  className="photo-button"
                  onClick={() => openCharacter(c.id)}
                  aria-label={`${t("查看", "View")} ${local(c.name, locale)}`}
                >
                  <Portrait character={c} />
                </button>
                <span className="ai-label">
                  <span />
                  AI TALENT
                </span>
                <button
                  className={`save-button ${c.liked ? "liked" : ""}`}
                  aria-label={
                    c.liked ? t("取消点赞", "Unlike") : t("点赞", "Like")
                  }
                  onClick={() => like(c)}
                >
                  <Heart size={18} fill={c.liked ? "currentColor" : "none"} />
                </button>
                <button
                  className="quick-save"
                  onClick={() => {
                    if (requireLogin()) setBoardChar(c);
                  }}
                >
                  <Bookmark size={15} />
                  {t("加入选角板", "Save to board")}
                </button>
                <span className="image-caption">
                  {local(c.personality, locale)
                    .split(" · ")
                    .slice(0, 2)
                    .join(" / ")}
                </span>
              </div>
              <div className="card-info">
                <div>
                  <button
                    className="card-name"
                    onClick={() => openCharacter(c.id)}
                  >
                    {local(c.name, locale)}
                    <span className="verified-dot">
                      <Check size={9} />
                    </span>
                  </button>
                  <p>
                    {c.age} {t("岁", "years")}
                    <span>·</span>
                    {local(c.personality, locale)}
                  </p>
                </div>
                <button
                  className="bookmark-small"
                  onClick={() => {
                    if (requireLogin()) setBoardChar(c);
                  }}
                  aria-label={t("收藏到选角板", "Save to casting board")}
                >
                  <Bookmark size={17} />
                </button>
              </div>
              <div className="card-tags">
                <span
                  className={
                    c.license === "commercial" ? "tag tag-green" : "tag"
                  }
                >
                  {c.demo
                    ? t("演示素材", "Demo asset")
                    : c.license === "commercial"
                      ? t("商业内容可用", "Commercial use")
                      : c.license === "noncommercial"
                        ? t("非商业使用", "Personal use")
                        : t("授权洽谈", "License on request")}
                </span>
                <span className="asset-status">
                  {c.package_count ? (
                    <>
                      <Layers size={11} />
                      {t("角色包就绪", "Package ready")}
                    </>
                  ) : (
                    t("形象展示", "Showcase")
                  )}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={Search}
          title={t("暂时没有精确匹配的人物", "No exact matches yet")}
          description={t(
            "试试扩大年龄范围或调整授权条件。我们不会自动放宽你的要求。",
            "Try a wider age range or a different license filter. Your requirements are never silently relaxed.",
          )}
        />
      )}
      <div className="discovery-footer">
        <span className="small-spark">✳</span>
        <span>
          {t(
            "独特的面孔，无限的故事。",
            "Distinctive faces. Infinite stories.",
          )}
        </span>
        <button onClick={() => navigate("studio")}>
          {t("创造你的下一位主角", "Create your next leading character")}
          <ArrowRight size={15} />
        </button>
      </div>
      {boardChar && (
        <SaveToBoard character={boardChar} onClose={() => setBoardChar(null)} />
      )}
    </>
  );
}
function Login({ onClose }: { onClose: () => void }) {
  const { t, cap, refreshMe, notify } = useApp();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (cap.demo) {
        await post("auth/demo");
      } else if (!sent) {
        await post("auth/otp", { email });
        setSent(true);
        return;
      } else {
        const d = await post("auth/verify", { email, token: code });
        if (d.session)
          sessionStorage.setItem(
            "avibe-supabase-session",
            JSON.stringify(d.session),
          );
      }
      await refreshMe();
      onClose();
      notify(t("欢迎来到 avibe", "Welcome to avibe"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={t("登录", "Sign in")}>
      <form className="login-form" onSubmit={submit}>
        <div className="brand">
          avibe<span>✳</span>
        </div>
        <h2>{t("你的故事，从这里开始。", "Your story starts here.")}</h2>
        <p>
          {cap.demo
            ? t(
                "创建一个独立的本地演示账号，体验选角与角色包下载。",
                "Start an isolated local demo session to explore casting and downloads.",
              )
            : t(
                "通过邮箱验证码进入你的创作空间。",
                "Sign in to your creative workspace with an email code.",
              )}
        </p>
        {!cap.demo && (
          <>
            <label>
              {t("邮箱", "Email")}
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            {sent && (
              <label>
                {t("验证码", "Verification code")}
                <input
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
            )}
          </>
        )}
        <ErrorBox message={error} />
        <button className="primary full" disabled={busy}>
          {busy
            ? t("请稍候…", "Please wait…")
            : cap.demo
              ? t("进入本地演示", "Enter local demo")
              : sent
                ? t("验证并登录", "Verify & sign in")
                : t("获取验证码", "Send code")}
          <ArrowRight size={17} />
        </button>
        {cap.demo && (
          <small>
            {t(
              "演示积分没有现金价值，不会发生真实支付。",
              "Demo credits have no monetary value. No real payment occurs.",
            )}
          </small>
        )}
      </form>
    </Modal>
  );
}
export function SaveToBoard({
  character,
  onClose,
  lookId,
}: {
  character: Data;
  onClose: () => void;
  lookId?: string;
}) {
  const { t, notify, locale } = useApp();
  const [boards, setBoards] = useState<Data[]>([]),
    [board, setBoard] = useState(""),
    [name, setName] = useState(""),
    [role, setRole] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("casting-boards")
      .then((d) => {
        setBoards(d.items);
        if (d.items[0]) setBoard(d.items[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let id = board;
      if (!id) {
        const b = await post("casting-boards", {
          name: name || t("我的新故事", "My next story"),
        });
        id = b.id;
      }
      const selectedLook =
        lookId || (await api(`characters/${character.id}`)).looks[0]?.id;
      if (!selectedLook)
        throw new Error(
          t("请先为角色创建造型", "Create a look before adding this character"),
        );
      await post(`casting-boards/${id}/entries`, {
        character_id: character.id,
        look_id: selectedLook,
        role_name: role,
      });
      notify(t("已加入选角板", "Added to casting board"));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={t("加入选角板", "Save to casting board")}>
      <form className="dialog-form" onSubmit={save}>
        <div className="eyebrow">CAST YOUR STORY</div>
        <h2>{t("为这个角色留个位置", "Make room in your story")}</h2>
        <p>{local(character.name, locale)}</p>
        <label>
          {t("选角板", "Casting board")}
          <select value={board} onChange={(e) => setBoard(e.target.value)}>
            <option value="">{t("＋ 新建选角板", "＋ New board")}</option>
            {boards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {!board && (
          <label>
            {t("项目名称", "Project name")}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("例如：秋日来信", "e.g. Letters in Autumn")}
            />
          </label>
        )}
        <label>
          {t("剧本中的身份", "Role in your story")}
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t(
              "例如：女主、父亲、咖啡店员",
              "e.g. Lead, father, barista",
            )}
          />
        </label>
        <ErrorBox message={error} />
        <button className="primary full" disabled={busy}>
          <Bookmark size={17} />
          {t("保存到选角板", "Save to board")}
        </button>
      </form>
    </Modal>
  );
}
function CharacterDetail({
  id,
  onClose,
  onTryOn,
}: {
  id: string;
  onClose: () => void;
  onTryOn: () => void;
}) {
  const { t, locale, requireLogin, notify, navigate, user } = useApp();
  const [c, setC] = useState<Data | null>(null),
    [lookId, setLookId] = useState(""),
    [purpose, setPurpose] = useState("personal"),
    [save, setSave] = useState(false),
    [error, setError] = useState(""),
    [tab, setTab] = useState("profile"),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`characters/${id}`)
      .then((d) => {
        setC(d);
        setLookId(
          (user && user.role !== "creator"
            ? d.looks.find((l: Data) => l.visibility === "pending")
            : null
          )?.id ||
            d.looks.find((l: Data) => l.identity_version === d.identity_version)
              ?.id ||
            d.looks[0]?.id ||
            "",
        );
      })
      .catch((e) => setError(e.message));
  }, [id, user]);
  const look = c?.looks.find((l: Data) => l.id === lookId);
  const displayed = look?.identity_profile || c;
  async function getPackage() {
    if (!requireLogin()) return;
    setBusy(true);
    try {
      await download(
        `/api/v1/packages/${look.package_id}/download?purpose=${purpose}`,
        `avibe-${id}.zip`,
      );
      notify(t("角色包已下载", "Character package downloaded"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function chat() {
    if (!requireLogin()) return;
    try {
      const conv = await post("conversations", {
        character_id: id,
        look_id: lookId || undefined,
      });
      sessionStorage.setItem("avibe-conversation", conv.id);
      onClose();
      navigate("messages");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      wide
      onClose={onClose}
      label={c ? local(c.name, locale) : t("达人详情", "Talent details")}
    >
      {!c ? (
        <>
          <Spinner />
          <ErrorBox message={error} />
        </>
      ) : (
        <>
          <div
            className={`detail-layout ${tab === "passport" ? "passport-layout" : ""}`}
          >
            <div className="detail-photo">
              <Portrait character={c} />
              <span className="detail-ai">
                avibe originals <span>✳</span>
              </span>
            </div>
            <div className="detail-content">
              <div className="eyebrow">
                DIGITAL TALENT / {c.id.slice(0, 10).toUpperCase()}
              </div>
              <h1>{local(c.name, locale)}</h1>
              <div className="detail-subtitle">
                {local(displayed.personality, locale)} · {displayed.age}{" "}
                {t("岁", "years old")}
              </div>
              <div className="detail-tabs">
                <button
                  className={tab === "profile" ? "active" : ""}
                  onClick={() => setTab("profile")}
                >
                  {t("认识 TA", "Meet the talent")}
                </button>
                <button
                  className={tab === "assets" ? "active" : ""}
                  onClick={() => setTab("assets")}
                >
                  {t("造型与角色卡", "Looks & assets")}
                </button>
                <button
                  className={tab === "passport" ? "active" : ""}
                  onClick={() => setTab("passport")}
                >
                  {t("资产护照", "Asset passport")}
                </button>
              </div>
              {c.owner_id === user?.id && (
                <button
                  className="text-button"
                  onClick={() => setEditing(true)}
                >
                  {t("修订人设与译文", "Revise profile & translations")}
                </button>
              )}
              {tab === "passport" ? (
                <AssetPassport
                  subjectId={id}
                  version={displayed.identity_version}
                  lookId={lookId || undefined}
                />
              ) : tab === "profile" ? (
                <>
                  <p className="biography">
                    {local(displayed.background, locale)}
                  </p>
                  <div className="detail-facts">
                    <div>
                      <span>{t("人物风格", "Style")}</span>
                      <strong>{t("写实人物", "Photorealistic")}</strong>
                    </div>
                    <div>
                      <span>{t("授权方式", "License")}</span>
                      <strong>
                        {c.demo
                          ? t("仅限本地评估", "Local evaluation only")
                          : c.license === "commercial"
                            ? t("允许商业内容", "Commercial content")
                            : c.license === "noncommercial"
                              ? t("非商业使用", "Noncommercial")
                              : t("联系商务授权", "Contact for license")}
                      </strong>
                    </div>
                    <div>
                      <span>{t("角色身份", "Character identity")}</span>
                      <strong>v{displayed.identity_version}</strong>
                    </div>
                    <div>
                      <span>{t("可用造型", "Available looks")}</span>
                      <strong>{c.looks.length}</strong>
                    </div>
                  </div>
                  <div className="license-note">
                    <ShieldCheck size={17} />
                    <p>{local(c.license_text, locale)}</p>
                  </div>
                </>
              ) : (
                <>
                  <label className="look-select">
                    {t("选择造型", "Select a look")}
                    <select
                      value={lookId}
                      onChange={(e) => setLookId(e.target.value)}
                    >
                      {c.looks.map((l: Data) => (
                        <option key={l.id} value={l.id}>
                          {local(l.name, locale)} · {t("身份", "Identity")} v
                          {l.identity_version} ·{" "}
                          {new Date(l.created_at).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="asset-previews">
                    {look?.assets
                      ?.filter((a: Data) => a.role !== "sheet")
                      .map((a: Data) => (
                        <a
                          key={a.id}
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img src={a.url} alt={a.role} />
                          <span>
                            {a.role === "identity"
                              ? t("身份", "Identity")
                              : a.role === "front"
                                ? t("正面", "Front")
                                : a.role === "back"
                                  ? t("背面", "Back")
                                  : t("侧面", "Side")}
                          </span>
                        </a>
                      ))}
                  </div>
                  {!look?.assets?.length && (
                    <p className="muted">
                      {user
                        ? t(
                            "此造型暂未提供可访问的参考图。",
                            "No accessible reference images for this look yet.",
                          )
                        : t(
                            "登录后查看已授权的角色素材。",
                            "Sign in to view licensed character references.",
                          )}
                    </p>
                  )}
                  {look?.inferred_back && (
                    <div className="notice">
                      {t(
                        "背面服装细节为推测生成，请检查后使用。",
                        "Back garment details are inferred. Review before use.",
                      )}
                    </div>
                  )}
                </>
              )}
              <label className="purpose-select">
                {t("本次使用用途", "Intended usage")}
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                >
                  <option value="personal">
                    {t("个人 / 非商业创作", "Personal / noncommercial")}
                  </option>
                  <option value="commercial">
                    {t("商业内容", "Commercial content")}
                  </option>
                  <option value="brand">
                    {t("品牌广告", "Brand advertising")}
                  </option>
                </select>
              </label>
              <ErrorBox message={error} />
              <div className="detail-actions">
                <button
                  className="primary"
                  disabled={!look?.package_id || busy}
                  onClick={getPackage}
                >
                  <Download size={17} />
                  {look?.package_id
                    ? t("下载角色包", "Download package")
                    : t("角色包待完善", "Package not ready")}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    if (requireLogin()) setSave(true);
                  }}
                >
                  <Bookmark size={17} />
                  {t("选角", "Save")}
                </button>
              </div>
              <div className="detail-links">
                <button
                  onClick={() => {
                    if (requireLogin()) onTryOn();
                  }}
                  disabled={!look?.package_id}
                >
                  <Shirt size={17} />
                  {t("试试新造型", "Try a new look")}
                </button>
                <button onClick={chat}>
                  {t("寻求品牌合作", "Discuss a collaboration")}
                  <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>
          {editing && (
            <ProfileEditor character={c} onClose={() => setEditing(false)} />
          )}{" "}
          {save && (
            <SaveToBoard
              character={c}
              lookId={lookId}
              onClose={() => setSave(false)}
            />
          )}
        </>
      )}
    </Modal>
  );
}
function SkillPage() {
  const { t } = useApp();
  return (
    <>
      <SectionHeading
        eyebrow="OPEN SOURCE / AVIBE CASTING"
        title={t("让角色，进入你的工作流。", "Your cast. In your workflow.")}
        description={t(
          "搜索、选角、下载。和你习惯使用的 AI Agent 一起创作。",
          "Search, cast and download with the AI agent you already use.",
        )}
      />
      <div className="skill-page">
        <Code2 size={38} />
        <h2>avibe-casting</h2>
        <p>
          {t(
            "Skill 与角色包规范开放，网站与 Skill 共用同一份角色目录和版本。",
            "The skill and package format are open. Your website selections and agent downloads use the same catalog and versions.",
          )}
        </p>
        <div className="code-block">
          python scripts/avibe.py search --query &quot;gentle urban lead&quot;
          <br />
          python scripts/avibe.py inspect CHARACTER_ID
          <br />
          python scripts/avibe.py download PACKAGE_ID --purpose personal
          --output ./cast
        </div>
        <p>
          {t(
            "在「我的空间」创建只读令牌，配置 AVIBE_BASE_URL 和 AVIBE_TOKEN。Skill 会校验每个文件，保留授权说明。",
            "Create a read-only token in My space, then set AVIBE_BASE_URL and AVIBE_TOKEN. Every file is verified and license information is preserved.",
          )}
        </p>
        <a className="primary" href="/api/skill/download">
          <Download size={17} />
          {t("下载开源 Skill", "Download open-source skill")}
        </a>
        <div className="notice">
          {t(
            "角色图片的使用授权独立于代码许可。受限资产需先获得授权。",
            "Character image licenses are separate from the code license. Restricted assets require authorization.",
          )}
        </div>
      </div>
    </>
  );
}
