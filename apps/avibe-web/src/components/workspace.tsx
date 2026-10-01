"use client";
import { PassportAdmin } from "./passport";
import { TalentLeads } from "./talent-leads";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutGrid,
  Plus,
  Download,
  Trash2,
  ArrowUpRight,
  MessageCircle,
  Send,
  ImagePlus,
  UserRound,
  Coins,
  Code2,
  Copy,
  Check,
  LogOut,
  ShieldCheck,
  Settings,
  Search,
  ArrowRight,
  Lock,
  FileText,
} from "lucide-react";
import {
  useApp,
  api,
  post,
  patch,
  local,
  Data,
  Portrait,
  SectionHeading,
  Empty,
  Spinner,
  Modal,
  ErrorBox,
  download,
} from "./ui";
export function Boards() {
  const { t, user, locale, requireLogin, notify, openCharacter, navigate } =
    useApp();
  const [items, setItems] = useState<Data[] | null>(null),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [name, setName] = useState(""),
    [purpose, setPurpose] = useState("personal");
  const load = useCallback(
    () => api("casting-boards").then((d) => setItems(d.items)),
    [],
  );
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user, load]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("casting-boards", { name });
      await load();
      setCreating(false);
      setName("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="CASTING BOARDS / COLLECT YOUR POSSIBILITIES"
        title={t("为你的故事，找到彼此。", "A cast that belongs together.")}
        description={t(
          "把心动的人物放进同一个故事。为 TA 分配角色，锁定造型，再带入你的工作流。",
          "Collect your favorites, assign their roles and bring a consistent cast into production.",
        )}
      >
        <button
          className="primary"
          onClick={() => {
            if (requireLogin()) setCreating(true);
          }}
        >
          <Plus size={17} />
          {t("新建选角板", "New board")}
        </button>
      </SectionHeading>
      <ErrorBox message={error} />
      {!user ? (
        <Empty
          icon={LayoutGrid}
          title={t(
            "你的故事，值得一份好阵容。",
            "Every story deserves a great cast.",
          )}
          description={t(
            "登录后创建项目选角板，收藏你的候选人物。",
            "Sign in to organize your projects and shortlist your talent.",
          )}
          action={t("登录并开始选角", "Sign in & start casting")}
          onAction={requireLogin}
        />
      ) : !items ? (
        <Spinner />
      ) : !items.length ? (
        <Empty
          icon={LayoutGrid}
          title={t(
            "第一份选角板，还在等你。",
            "Your first casting board awaits.",
          )}
          description={t(
            "从发现页收藏人物，或先创建一个新的故事项目。",
            "Save talent from Discover, or start with a new project.",
          )}
          action={t("发现数字达人", "Discover talent")}
          onAction={() => navigate("discover")}
        />
      ) : (
        <div className="boards-list">
          {items.map((board) => (
            <section key={board.id} className="panel board-panel">
              <div className="board-heading">
                <div>
                  <span className="eyebrow">CASTING BOARD</span>
                  <h2>{board.name}</h2>
                  <p>
                    {board.entries.length} {t("位候选人物", "cast members")}
                  </p>
                </div>
                <div className="inline-controls">
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    aria-label={t("导出用途", "Export purpose")}
                  >
                    <option value="personal">
                      {t("个人创作", "Personal use")}
                    </option>
                    <option value="commercial">
                      {t("商业内容", "Commercial use")}
                    </option>
                    <option value="brand">{t("品牌广告", "Brand ads")}</option>
                  </select>
                  <button
                    className="secondary"
                    disabled={!board.entries.length}
                    onClick={async () => {
                      try {
                        await download(
                          `/api/v1/casting-boards/${board.id}/export?purpose=${purpose}`,
                          "avibe-cast.zip",
                        );
                        notify(t("选角包已导出", "Cast package exported"));
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <Download size={16} />
                    {t("导出选角包", "Export cast")}
                  </button>
                </div>
              </div>
              {!board.entries.length ? (
                <div
                  className="board-empty"
                  onClick={() => navigate("discover")}
                >
                  <Plus size={22} />
                  {t(
                    "从发现页添加第一位人物",
                    "Add your first character from Discover",
                  )}
                </div>
              ) : (
                <div className="board-cast">
                  {board.entries.map((e: Data) => (
                    <article key={e.id}>
                      <button
                        className="board-photo"
                        onClick={() => openCharacter(e.character_id)}
                      >
                        <Portrait character={e} />
                      </button>
                      <div className="board-entry-name">
                        <strong>{local(e.name, locale)}</strong>
                        <button
                          className="icon-button"
                          aria-label={t("移除角色", "Remove cast member")}
                          onClick={async () => {
                            await api(
                              `casting-boards/${board.id}/entries/${e.id}`,
                              { method: "DELETE" },
                            );
                            load();
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <input
                        aria-label={t("剧本身份", "Story role")}
                        defaultValue={e.role_name}
                        placeholder={t("分配剧本角色…", "Assign a story role…")}
                        onBlur={async (ev) => {
                          if (ev.target.value !== e.role_name) {
                            try {
                              await post(`casting-boards/${board.id}/entries`, {
                                character_id: e.character_id,
                                look_id: e.look_id,
                                role_name: ev.target.value,
                              });
                              notify(
                                t("角色分配已保存", "Role assignment saved"),
                              );
                            } catch (err) {
                              setError((err as Error).message);
                            }
                          }
                        }}
                      />
                      <small className={e.package_id ? "text-green" : "muted"}>
                        {e.package_id
                          ? t("已锁定角色包版本", "Package version pinned")
                          : t(
                              "展示素材，角色包待完善",
                              "Showcase only · package pending",
                            )}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {creating && (
        <Modal
          onClose={() => setCreating(false)}
          label={t("新建选角板", "New casting board")}
        >
          <form className="dialog-form" onSubmit={create}>
            <h2>{t("给故事起个名字。", "Give your story a name.")}</h2>
            <label>
              {t("项目名称", "Project name")}
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("例如：秋日来信", "e.g. Letters in Autumn")}
              />
            </label>
            <button className="primary full">
              {t("创建选角板", "Create board")}
              <ArrowRight size={16} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function Messages() {
  const { t, user, locale, requireLogin, cap, notify } = useApp();
  const [convs, setConvs] = useState<Data[]>([]),
    [selected, setSelected] = useState(""),
    [messages, setMessages] = useState<Data[]>([]),
    [text, setText] = useState(""),
    [asset, setAsset] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [internal, setInternal] = useState(false),
    [staff, setStaff] = useState<Data[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const chosen = convs.find((c) => c.id === selected);
  const loadConvs = useCallback(async () => {
    const d = await api("conversations");
    setConvs(d.items);
    return d.items;
  }, []);
  const loadMessages = useCallback(async () => {
    if (!selected) return;
    const d = await api(`conversations/${selected}/messages`);
    setMessages(d.items);
  }, [selected]);
  useEffect(() => {
    if (!user) return;
    loadConvs()
      .then((items) => {
        const saved = sessionStorage.getItem("avibe-conversation");
        setSelected(
          saved && items.some((c: Data) => c.id === saved)
            ? saved
            : items[0]?.id || "",
        );
      })
      .catch((e) => setError(e.message));
    if (user.role !== "creator")
      api("admin/overview")
        .then((d) => setStaff(d.staff))
        .catch(() => {});
  }, [user, loadConvs]);
  useEffect(() => {
    if (!selected || !user) return;
    loadMessages().catch((e) => setError(e.message));
    const poll = setInterval(() => {
      loadMessages().catch(() => {});
      loadConvs().catch(() => {});
    }, 5000);
    let cleanup = () => {};
    if (
      cap.realtime &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ) {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const stored = sessionStorage.getItem("avibe-supabase-session");
      if (stored) {
        const s = JSON.parse(stored);
        sb.auth.setSession(s).then(() => {
          const channel = sb
            .channel(`conversation:${selected}`, { config: { private: true } })
            .on("broadcast", { event: "message" }, () => loadMessages())
            .subscribe();
          cleanup = () => {
            sb.removeChannel(channel);
          };
        });
      }
    }
    return () => {
      clearInterval(poll);
      cleanup();
    };
  }, [selected, user, cap.realtime, loadMessages, loadConvs]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !asset) return;
    setBusy(true);
    try {
      await post(`conversations/${selected}/messages`, {
        body: text,
        asset_id: asset?.id,
        client_id: crypto.randomUUID(),
        internal: user?.role !== "creator" && internal,
      });
      setText("");
      setAsset(null);
      await loadMessages();
      await loadConvs();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("role", "chat");
      setAsset(await api("assets", { method: "POST", body: form }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="COLLABORATIONS / LET'S MAKE SOMETHING"
        title={t("好故事，值得一起发生。", "Good stories bring us together.")}
        description={t(
          "与 avibe 商务讨论抖音、小红书合作、角色授权及定制内容。",
          "Talk with avibe about brand campaigns, character licensing and custom productions.",
        )}
      />
      <ErrorBox message={error} />
      {!user ? (
        <Empty
          icon={MessageCircle}
          title={t(
            "开启一场关于合作的对话。",
            "Start a conversation about possibilities.",
          )}
          description={t(
            "登录后，从任意达人详情页发起合作。",
            "Sign in, then start a collaboration from any talent profile.",
          )}
          action={t("登录", "Sign in")}
          onAction={requireLogin}
        />
      ) : !convs.length ? (
        <Empty
          icon={MessageCircle}
          title={t("还没有商务会话", "No conversations yet")}
          description={t(
            "在达人详情页点击「寻求品牌合作」，即可联系 avibe 商务。",
            "Choose “Discuss a collaboration” on a talent profile to contact avibe.",
          )}
        />
      ) : (
        <div className="chat-layout">
          <aside className="conversation-list">
            <div className="conversation-label">
              {t("商务会话", "Conversations")}
              <span>{convs.length}</span>
            </div>
            {convs.map((c) => (
              <button
                key={c.id}
                className={selected === c.id ? "active" : ""}
                onClick={() => setSelected(c.id)}
              >
                <Portrait character={{ ...c, name: c.character_name }} />
                <div>
                  <strong>{local(c.character_name, locale)}</strong>
                  <p>
                    {c.last_message ||
                      t("开始讨论合作需求", "Share your collaboration brief")}
                  </p>
                </div>
                {c.unread > 0 && <span className="unread">{c.unread}</span>}
              </button>
            ))}
          </aside>
          <section className="chat-main">
            <div className="chat-heading">
              <span className="business-avatar">a</span>
              <div>
                <strong>avibe {t("商务团队", "Partnerships")}</strong>
                <small>
                  {t(
                    "消息会保留，商务人员上线后回复",
                    "Messages are saved. Our team replies when available.",
                  )}
                </small>
              </div>
              <span className="tag">{chosen?.status}</span>
            </div>
            {chosen && (
              <div className="chat-context">
                <ShieldCheck size={15} />
                {t("合作达人", "Selected talent")} ·{" "}
                {local(chosen.character_name, locale)}
                {user.role !== "creator" && (
                  <div className="inline-controls">
                    <select
                      aria-label="Conversation status"
                      value={chosen.status}
                      onChange={async (e) => {
                        await patch(`conversations/${selected}`, {
                          status: e.target.value,
                          assigned_to: chosen.assigned_to,
                        });
                        loadConvs();
                      }}
                    >
                      {["open", "negotiating", "won", "closed"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Assigned staff"
                      value={chosen.assigned_to || ""}
                      onChange={async (e) => {
                        await patch(`conversations/${selected}`, {
                          status: chosen.status,
                          assigned_to: e.target.value || null,
                        });
                        loadConvs();
                      }}
                    >
                      <option value="">{t("未分配", "Unassigned")}</option>
                      {staff.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="message-list">
              {!messages.length && (
                <div className="chat-welcome">
                  <MessageCircle size={28} />
                  <h3>
                    {t(
                      "聊聊你想创造什么。",
                      "Tell us what you want to create.",
                    )}
                  </h3>
                  <p>
                    {t(
                      "可以从品牌、发布平台、期望档期和预算开始。",
                      "A brand, platform, timeline and budget are a great place to start.",
                    )}
                  </p>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`message ${m.sender_id === user.id ? "mine" : ""} ${m.internal ? "internal" : ""}`}
                >
                  <small>
                    {m.internal
                      ? `🔒 ${t("内部备注", "Internal note")}`
                      : m.sender_id === user.id
                        ? t("你", "You")
                        : `avibe ${t("商务", "Partnerships")}`}
                  </small>
                  <div className="message-bubble">
                    {m.asset_id && (
                      <a
                        href={`/api/v1/assets/${m.asset_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={`/api/v1/assets/${m.asset_id}`}
                          alt="Attachment"
                        />
                      </a>
                    )}
                    {m.body && <p>{m.body}</p>}
                  </div>
                  <time>
                    {new Date(m.created_at).toLocaleTimeString(
                      locale === "zh" ? "zh-CN" : "en-US",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </time>
                </div>
              ))}
              <div ref={end} />
            </div>
            <form className="chat-compose" onSubmit={send}>
              {asset && (
                <div className="attachment-chip">
                  <ImagePlus size={15} />
                  {t("图片已附加", "Image attached")}
                  <button type="button" onClick={() => setAsset(null)}>
                    ×
                  </button>
                </div>
              )}
              {user.role !== "creator" && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />
                  {t(
                    "内部备注（用户不可见）",
                    "Internal note (hidden from client)",
                  )}
                </label>
              )}
              <div>
                <label
                  className="icon-button file-button"
                  aria-label={t("上传图片", "Upload image")}
                >
                  <ImagePlus size={20} />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => upload(e.target.files?.[0])}
                  />
                </label>
                <textarea
                  rows={1}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t(
                    "分享你的合作想法…",
                    "Share your collaboration idea…",
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />
                <button
                  className="send-button"
                  disabled={busy || (!text.trim() && !asset)}
                  aria-label={t("发送", "Send")}
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
export function Account() {
  const {
    t,
    user,
    locale,
    cap,
    wallet,
    requireLogin,
    refreshMe,
    notify,
    navigate,
    openCharacter,
  } = useApp();
  const [billing, setBilling] = useState<Data | null>(null),
    [tokens, setTokens] = useState<Data[]>([]),
    [newToken, setNewToken] = useState(""),
    [error, setError] = useState(""),
    [provider, setProvider] = useState(cap.payment_providers?.[0] || "wechat"),
    [checkout, setCheckout] = useState<Data | null>(null),
    [mine, setMine] = useState<Data[]>([]);
  const load = useCallback(async () => {
    const [b, k, c] = await Promise.all([
      api("billing"),
      api("tokens"),
      api("characters?limit=60"),
    ]);
    setBilling(b);
    setTokens(k.items);
    setMine(c.items.filter((x: Data) => x.owner_id === user?.id));
  }, [user?.id]);
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user, load]);
  async function token() {
    try {
      const d = await post("tokens", { name: "avibe-casting" });
      setNewToken(d.token);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <SectionHeading
        eyebrow="YOUR SPACE / A CREATIVE HOME"
        title={t("让每一个灵感，有处安放。", "A home for every new idea.")}
        description={t(
          "管理你的人物、创作积分和工作流连接。",
          "Manage your characters, credits and creative workflow.",
        )}
      />
      {!user ? (
        <Empty
          icon={UserRound}
          title={t("欢迎来到你的创作空间", "Welcome to your creative space")}
          description={t(
            "你的私人角色、选角板和创作记录都在这里。",
            "Your private characters, casting boards and creative history live here.",
          )}
          action={t("登录", "Sign in")}
          onAction={requireLogin}
        />
      ) : (
        <>
          <ErrorBox message={error} />
          <div className="account-grid">
            <section className="credit-card">
              <div className="eyebrow">YOUR CREATIVE ENERGY</div>
              <h2>{t("创作积分", "Creation credits")}</h2>
              <div className="balance">
                {wallet ? wallet.balance - wallet.held : 0}
                <span>{t("可用积分", "available")}</span>
              </div>
              <small>
                {wallet?.held || 0} {t("积分冻结中", "credits reserved")}
                {cap.demo
                  ? ` · ${t("演示额度，无现金价值", "Demo balance, no monetary value")}`
                  : ""}
              </small>
              <button onClick={() => navigate("studio")}>
                {t("开始新的创作", "Start something new")}
                <ArrowUpRight size={19} />
              </button>
            </section>
            <section className="panel account-profile">
              <span className="large-avatar">
                {user.email.slice(0, 1).toUpperCase()}
              </span>
              <h3>
                {cap.demo ? t("本地创作者", "Local creator") : user.email}
              </h3>
              <p className="muted">
                {cap.demo
                  ? t("独立的本地演示账号", "An isolated local demo session")
                  : user.role}
              </p>
              <button
                className="secondary"
                onClick={async () => {
                  await post("auth/logout");
                  sessionStorage.removeItem("avibe-supabase-session");
                  await refreshMe();
                  navigate("discover");
                }}
              >
                <LogOut size={15} />
                {t("退出登录", "Sign out")}
              </button>
              {user.role !== "creator" && (
                <button
                  className="text-button"
                  onClick={() => navigate("admin")}
                >
                  <Settings size={15} />
                  {t("运营后台", "Operations")}
                </button>
              )}
            </section>
          </div>
          <section className="panel account-section">
            <div className="panel-heading">
              <div>
                <h2>{t("我的数字达人", "My digital talent")}</h2>
                <p>
                  {t(
                    "私人草稿只对你可见，公开需经过审核。",
                    "Private drafts are visible only to you. Publication requires review.",
                  )}
                </p>
              </div>
              <button className="secondary" onClick={() => navigate("studio")}>
                <Plus size={16} />
                {t("新建", "Create")}
              </button>
            </div>
            {mine.length ? (
              <div className="mini-cast-grid">
                {mine.map((c) => (
                  <button key={c.id} onClick={() => openCharacter(c.id)}>
                    <Portrait character={c} />
                    <strong>{local(c.name, locale)}</strong>
                    <small>{c.status}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">
                {t(
                  "还没有私人角色。先从一个人物想法开始吧。",
                  "No private characters yet. Start with an idea.",
                )}
              </p>
            )}
          </section>
          <section className="panel account-section">
            <div className="panel-heading">
              <div>
                <h2>{t("充值积分", "Top up credits")}</h2>
                <p>
                  {t(
                    "生成任务按报价冻结，技术失败自动解冻。",
                    "Generation is quoted in advance. Technical failures release reserved credits.",
                  )}
                </p>
              </div>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                aria-label={t("支付方式", "Payment method")}
              >
                <option
                  value="wechat"
                  disabled={!cap.payment_providers?.includes("wechat")}
                >
                  {t("微信支付", "WeChat Pay")}
                </option>
                <option
                  value="alipay"
                  disabled={!cap.payment_providers?.includes("alipay")}
                >
                  {t("支付宝", "Alipay")}
                </option>
              </select>
            </div>
            {!billing?.enabled || !billing?.plans?.length ? (
              <div className="notice">
                {t(
                  "暂未开放真实充值。支付服务和套餐配置完成后，才会显示可购买的积分。",
                  "Real top-ups are not available yet. Purchases appear after payment services and plans are configured.",
                )}
              </div>
            ) : (
              <div className="plans-grid">
                {billing.plans.map((p: Data) => (
                  <button
                    key={p.id}
                    onClick={async () => {
                      try {
                        const d = await post("billing/orders", {
                          plan_id: p.id,
                          provider,
                        });
                        setCheckout(d);
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <strong>{p.name}</strong>
                    <span>
                      {p.credits} {t("积分", "credits")}
                    </span>
                    <b>¥{(p.amount_fen / 100).toFixed(2)}</b>
                  </button>
                ))}
              </div>
            )}
            <div className="ledger">
              {billing?.ledger?.map((l: Data) => (
                <div key={l.id}>
                  <span>
                    {(
                      {
                        hold: t("任务积分冻结", "Generation reservation"),
                        release: t("失败解冻", "Reservation released"),
                        spend: t("生成交付", "Generation delivered"),
                        topup: t("充值到账", "Payment credited"),
                        demo: t("本地演示额度", "Local demo credits"),
                      } as any
                    )[l.kind] || l.kind}
                    <small>{new Date(l.created_at).toLocaleString()}</small>
                  </span>
                  <strong className={l.kind === "spend" ? "" : "text-green"}>
                    {l.amount > 0 ? "+" : ""}
                    {l.amount}
                  </strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel account-section">
            <div className="panel-heading">
              <div>
                <h2>
                  <Code2 size={20} />{" "}
                  {t("连接 avibe Skill", "Connect avibe Skill")}
                </h2>
                <p>
                  {t(
                    "令牌仅支持检索和下载，不会允许充值或生成。",
                    "Tokens allow search and download only. They cannot spend credits or create content.",
                  )}
                </p>
              </div>
              <button className="secondary" onClick={token}>
                <Plus size={16} />
                {t("创建令牌", "Create token")}
              </button>
            </div>
            {newToken && (
              <div className="token-reveal">
                <p>
                  {t(
                    "仅显示一次，请保存到本机环境变量 AVIBE_TOKEN。",
                    "Shown once. Save it locally as the AVIBE_TOKEN environment variable.",
                  )}
                </p>
                <code>{newToken}</code>
                <button
                  className="icon-button"
                  aria-label="Copy token"
                  onClick={() => {
                    navigator.clipboard.writeText(newToken);
                    notify(t("令牌已复制", "Token copied"));
                  }}
                >
                  <Copy size={17} />
                </button>
              </div>
            )}
            <div className="token-list">
              {tokens.map((k) => (
                <div key={k.id}>
                  <span>
                    <Code2 size={16} />
                    {k.name}
                    <small>
                      {k.revoked_at
                        ? t("已撤销", "Revoked")
                        : "read · download"}
                    </small>
                  </span>
                  {!k.revoked_at && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        await api(`tokens/${k.id}`, { method: "DELETE" });
                        load();
                      }}
                    >
                      {t("撤销", "Revoke")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
      {checkout && (
        <Modal
          onClose={() => setCheckout(null)}
          label={t("完成支付", "Complete payment")}
        >
          <div className="dialog-form">
            <h2>{t("完成积分充值", "Complete your top-up")}</h2>
            <div className="quote-number">
              ¥{(checkout.amount_fen / 100).toFixed(2)}
            </div>
            {checkout.checkout.type === "redirect" ? (
              <a
                className="primary full"
                target="_blank"
                rel="noreferrer"
                href={checkout.checkout.url}
              >
                {t("前往支付宝", "Open Alipay")}
                <ArrowUpRight size={16} />
              </a>
            ) : (
              <>
                <p>
                  {t(
                    "使用微信扫描支付二维码。",
                    "Scan the QR code with WeChat.",
                  )}
                </p>
                <img
                  className="payment-qr"
                  src={`/api/qr?value=${encodeURIComponent(checkout.checkout.url)}`}
                  alt="WeChat payment QR code"
                />
              </>
            )}
            <button
              className="secondary full"
              onClick={async () => {
                try {
                  const o = await api(`billing/orders/${checkout.id}`);
                  if (o.status === "paid") {
                    await refreshMe();
                    await load();
                    setCheckout(null);
                    notify(t("充值成功", "Payment received"));
                  } else
                    notify(
                      t(
                        "暂未确认付款，请稍后重试",
                        "Payment has not been confirmed. Try again shortly.",
                      ),
                    );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {t("已完成支付，检查到账", "I have paid · Check status")}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Admin() {
  const { t, user, requireLogin, notify, openCharacter } = useApp();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [grant, setGrant] = useState({
      user_id: "",
      character_id: "",
      purpose: "commercial",
      expires_at: null,
    }),
    [plan, setPlan] = useState({
      id: "",
      name: "",
      amount_fen: 1000,
      credits: 100,
      active: false,
    });
  const load = useCallback(() => api("admin/overview").then(setData), []);
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user, load]);
  if (!user || user.role === "creator")
    return (
      <Empty
        icon={Lock}
        title={t("运营人员专用", "Staff workspace")}
        description={t(
          "需要运营或管理员账号。",
          "A staff or administrator account is required.",
        )}
      />
    );
  return (
    <>
      <SectionHeading
        eyebrow="AVIBE OPERATIONS"
        title={t(
          "让每一份角色资产，准备就绪。",
          "Prepare every character for their next story.",
        )}
        description={t(
          "审核公开内容、管理报价与授权。",
          "Review submissions, configure pricing and manage licenses.",
        )}
      />
      <ErrorBox message={error} />
      {!data ? (
        <Spinner />
      ) : (
        <>
          <PassportAdmin />
          <TalentLeads items={data.talent_leads || []} />
          <section className="panel account-section">
            <h2>{t("待审核造型", "Pending submissions")}</h2>
            {!data.pending_looks.length && (
              <p className="muted">
                {t("暂无待审核投稿。", "No pending submissions.")}
              </p>
            )}
            {data.pending_looks.map((l: Data) => (
              <div className="review-row" key={l.id}>
                <div>
                  <strong>
                    {l.character_name.zh} / {l.character_name.en}
                  </strong>
                  <p>
                    {l.name.zh} · {l.id}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => openCharacter(l.character_id)}
                  >
                    {t(
                      "查看人设与全部视图",
                      "Inspect profile and reference views",
                    )}
                  </button>
                </div>
                <button
                  className="secondary"
                  onClick={async () => {
                    await post("admin/review", {
                      character_id: l.character_id,
                      look_id: l.id,
                      approved: false,
                    });
                    load();
                  }}
                >
                  {t("退回", "Return")}
                </button>
                <button
                  className="primary"
                  onClick={async () => {
                    await post("admin/review", {
                      character_id: l.character_id,
                      look_id: l.id,
                      approved: true,
                    });
                    load();
                  }}
                >
                  {t("审核通过", "Approve")}
                </button>
              </div>
            ))}
          </section>
          <section className="panel account-section">
            <h2>{t("生成价格", "Generation prices")}</h2>
            {data.pricing.map((p: Data) => (
              <form
                className="pricing-row"
                key={p.kind}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  try {
                    await post("admin/pricing", {
                      kind: p.kind,
                      credits: Number(f.get("credits")),
                      active: f.get("active") === "on",
                    });
                    load();
                    notify(t("报价已更新", "Pricing updated"));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <strong>{p.kind}</strong>
                <input
                  aria-label={`${p.kind} credits`}
                  type="number"
                  name="credits"
                  min="1"
                  defaultValue={p.credits}
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="active"
                    defaultChecked={p.active}
                  />
                  {t("启用", "Active")}
                </label>
                <button className="secondary" disabled={user.role !== "admin"}>
                  {t("保存", "Save")}
                </button>
              </form>
            ))}
          </section>
          {user.role === "admin" && (
            <div className="admin-grid">
              <form
                className="panel dialog-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await post("admin/plans", plan);
                    notify(t("套餐已保存", "Plan saved"));
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <h2>{t("充值套餐", "Top-up plan")}</h2>
                {["id", "name", "amount_fen", "credits"].map((k) => (
                  <label key={k}>
                    {
                      (
                        {
                          id: "ID",
                          name: t("名称", "Name"),
                          amount_fen: t(
                            "价格（人民币分）",
                            "Price (CNY cents)",
                          ),
                          credits: t("积分", "Credits"),
                        } as any
                      )[k]
                    }
                    <input
                      required
                      type={
                        ["amount_fen", "credits"].includes(k)
                          ? "number"
                          : "text"
                      }
                      value={(plan as any)[k]}
                      onChange={(e) =>
                        setPlan((v) => ({
                          ...v,
                          [k]: ["amount_fen", "credits"].includes(k)
                            ? Number(e.target.value)
                            : e.target.value,
                        }))
                      }
                    />
                  </label>
                ))}
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={(e) =>
                      setPlan((v) => ({ ...v, active: e.target.checked }))
                    }
                  />
                  {t("启用套餐", "Activate plan")}
                </label>
                <button className="primary">
                  {t("保存套餐", "Save plan")}
                </button>
              </form>
              <form
                className="panel dialog-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await post("admin/grants", grant);
                    notify(t("授权已登记", "License grant recorded"));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <h2>{t("登记角色授权", "Grant character license")}</h2>
                <label>
                  {t("用户 ID", "User ID")}
                  <input
                    required
                    value={grant.user_id}
                    onChange={(e) =>
                      setGrant((v) => ({ ...v, user_id: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("角色 ID", "Character ID")}
                  <input
                    required
                    value={grant.character_id}
                    onChange={(e) =>
                      setGrant((v) => ({ ...v, character_id: e.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("授权用途", "Authorized use")}
                  <select
                    value={grant.purpose}
                    onChange={(e) =>
                      setGrant((v) => ({ ...v, purpose: e.target.value }))
                    }
                  >
                    <option value="personal">Personal</option>
                    <option value="commercial">Commercial</option>
                    <option value="brand">Brand</option>
                  </select>
                </label>
                <button className="primary">
                  {t("登记授权", "Record license grant")}
                </button>
              </form>
            </div>
          )}
          <div className="panel account-section">
            <h2>{t("使用指标", "Usage metrics")}</h2>
            <div className="metrics">
              {data.metrics.map((m: Data) => (
                <div key={m.name}>
                  <b>{m.count}</b>
                  <span>{m.name}</span>
                </div>
              ))}
              {data.generation.map((m: Data) => (
                <div key={m.status}>
                  <b>{m.count}</b>
                  <span>{m.status}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
