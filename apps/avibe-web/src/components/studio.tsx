"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Shirt,
  ArrowRight,
  Upload,
  Check,
  UserRound,
  Plus,
  Layers,
  RotateCcw,
  Image as ImageIcon,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  useApp,
  api,
  post,
  Data,
  local,
  Portrait,
  SectionHeading,
  Empty,
  ErrorBox,
  Modal,
} from "./ui";
export function Studio({
  initialCharacter,
}: {
  initialCharacter: string | null;
}) {
  const {
    t,
    user,
    locale,
    cap,
    notify,
    requireLogin,
    refreshMe,
    openCharacter,
  } = useApp();
  const [mode, setMode] = useState(initialCharacter ? "tryon" : "create"),
    [depth, setDepth] = useState("quick"),
    [characters, setCharacters] = useState<Data[]>([]),
    [selected, setSelected] = useState(initialCharacter || ""),
    [character, setCharacter] = useState<Data | null>(null),
    [lookId, setLookId] = useState(""),
    [garments, setGarments] = useState<Data[]>([]),
    [garmentView, setGarmentView] = useState("front"),
    [garmentCategory, setGarmentCategory] = useState("casual"),
    [scope, setScope] = useState("outfit"),
    [prompt, setPrompt] = useState(""),
    [jobs, setJobs] = useState<Data[]>([]),
    [reviewed, setReviewed] = useState<Record<string, boolean>>({}),
    [enrich, setEnrich] = useState(false),
    [profileEdits, setProfileEdits] = useState<Record<string, Data>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<Data | null>(null),
    [draft, setDraft] = useState<Data | null>(null);
  const [form, setForm] = useState({
    nameZh: "",
    nameEn: "",
    age: 26,
    gender: "woman",
    personalityZh: "",
    personalityEn: "",
    backgroundZh: "",
    backgroundEn: "",
    anchorsZh: "",
    anchorsEn: "",
    license: "negotiation",
    commercial: false,
    brand: false,
  });
  const load = useCallback(async () => {
    if (!user) return;
    const [c, j] = await Promise.all([
      api("characters?limit=60"),
      api("generation-jobs"),
    ]);
    setCharacters(c.items);
    setJobs(j.items);
  }, [user]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
    if (!user) return;
    const timer = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(timer);
  }, [load, user]);
  useEffect(() => {
    if (!selected) {
      setCharacter(null);
      return;
    }
    api(`characters/${selected}`)
      .then((c) => {
        setCharacter(c);
        setLookId(
          c.looks.find((l: Data) => l.package_id)?.id || c.looks[0]?.id || "",
        );
      })
      .catch((e) => setError(e.message));
  }, [selected]);
  async function prepare(input: Data) {
    if (!requireLogin()) return;
    setBusy(true);
    setError("");
    try {
      const price = await post("generation-jobs/quote", { kind: input.kind });
      setQuote({ input, price, idempotency_key: crypto.randomUUID() });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!quote) return;
    setBusy(true);
    setError("");
    try {
      await post("generation-jobs", {
        ...quote.input,
        idempotency_key: quote.idempotency_key,
        expected_price_version: quote.price.version,
        expected_credits: quote.price.credits,
      });
      setQuote(null);
      await load();
      await refreshMe();
      notify(
        t("生成任务已提交，积分已冻结", "Generation queued. Credits reserved."),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    setBusy(true);
    setError("");
    try {
      const data = {
        name: { zh: form.nameZh, en: form.nameEn },
        age: Number(form.age),
        gender: form.gender,
        personality: {
          zh: form.personalityZh,
          en: form.personalityEn || form.personalityZh,
        },
        background: {
          zh:
            form.backgroundZh ||
            t("待完善的人物背景", "Character background to be developed"),
          en:
            form.backgroundEn ||
            form.backgroundZh ||
            "Character background to be developed",
        },
        anchors: {
          zh: form.anchorsZh || prompt || "保持脸型、发型、年龄感及身体比例。",
          en:
            form.anchorsEn ||
            "Preserve facial geometry, hair, apparent age and body proportions.",
        },
        tags: [],
        license: form.license,
        commercial: form.commercial,
        brand_collaboration: form.brand,
        license_text: {
          zh:
            form.license === "negotiation"
              ? "未经单独授权不可用于商业内容。"
              : "作者指定的使用许可；正式发布前需审核。",
          en:
            form.license === "negotiation"
              ? "Commercial use requires separate permission."
              : "Creator-selected license; review required before publication.",
        },
      };
      const c = await post("characters", data);
      setDraft(c);
      await load();
      notify(t("私人角色草稿已保存", "Private character draft saved"));
      await prepare({
        kind: "candidates",
        character_id: c.id,
        prompt,
        enrich_profile: enrich,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!requireLogin() || !files) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, 6 - garments.length)) {
        const f = new FormData();
        f.set("file", file);
        f.set("role", "garment");
        f.set("view", garmentView);
        f.set("category", garmentCategory);
        const a = await api("assets", { method: "POST", body: f });
        setGarments((g) => [...g, a]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approve(job: Data, identity?: string) {
    setBusy(true);
    try {
      const accepted = await post(`generation-jobs/${job.id}/approve`, {
        identity_asset_id: identity,
        quality_confirmed: !!reviewed[job.id],
        profile_override: job.output.suggested_profile
          ? profileEdits[job.id] || job.output.suggested_profile
          : undefined,
      });
      await load();
      await refreshMe();
      notify(t("已确认并保存", "Approved and saved"));
      if (identity)
        await prepare({
          kind: "views",
          character_id: job.input.character_id,
          identity_version:
            accepted.identity_version || job.input.identity_version,
          identity_asset_id: identity,
          prompt,
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const f = (key: string) => ({
    value: (form as any)[key],
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setForm((v) => ({ ...v, [key]: e.target.value })),
  });
  return (
    <>
      <SectionHeading
        eyebrow="AVIBE STUDIO / BRING SOMEONE TO LIFE"
        title={t(
          "下一位主角，由你创造。",
          "Bring your next character to life.",
        )}
        description={t(
          "从一个人物想法开始。确认身份，再探索属于 TA 的不同造型。",
          "Start with an idea. Find their identity, then explore their wardrobe.",
        )}
      />
      <div className="studio-tabs">
        <button
          className={mode === "create" ? "active" : ""}
          onClick={() => setMode("create")}
        >
          <Sparkles size={18} />
          {t("新建数字达人", "Create talent")}
        </button>
        <button
          className={mode === "tryon" ? "active" : ""}
          onClick={() => setMode("tryon")}
        >
          <Shirt size={18} />
          {t("服装与造型", "Wardrobe & styling")}
        </button>
        <button
          className={mode === "jobs" ? "active" : ""}
          onClick={() => setMode("jobs")}
        >
          <Layers size={18} />
          {t("生成记录", "Generation history")}
          {jobs.length > 0 && <span>{jobs.length}</span>}
        </button>
      </div>
      {!cap.generation && (
        <div className="notice">
          <AlertCircle size={17} />
          {t(
            "尚未接入生图服务。你可以保存人设草稿；配置服务后即可生成，当前不会扣分。",
            "Generation is not connected yet. You can save character drafts. Credits are not charged until the service is configured.",
          )}
        </div>
      )}
      <ErrorBox message={error} />
      {mode === "create" ? (
        <div className="studio-layout">
          <form className="studio-form panel" onSubmit={saveDraft}>
            <div className="form-heading">
              <span className="step-number">01</span>
              <div>
                <h2>{t("先认识这个人", "Meet your character")}</h2>
                <p>
                  {t(
                    "人设是角色的起点，也是一致性的依据。",
                    "A clear identity is the foundation of a consistent character.",
                  )}
                </p>
              </div>
            </div>
            <div className="segmented">
              <button
                type="button"
                className={depth === "quick" ? "selected" : ""}
                onClick={() => setDepth("quick")}
              >
                {t("快速角色", "Quick character")}
              </button>
              <button
                type="button"
                className={depth === "full" ? "selected" : ""}
                onClick={() => setDepth("full")}
              >
                {t("完整达人", "Full talent profile")}
              </button>
            </div>
            <div className="form-grid">
              <label>
                {t("中文姓名", "Chinese name")}
                <input required placeholder="林悦" {...f("nameZh")} />
              </label>
              <label>
                {t("英文姓名", "English name")}
                <input required placeholder="Lin Yue" {...f("nameEn")} />
              </label>
              <label>
                {t("年龄设定", "Character age")}
                <input type="number" min="1" max="110" required {...f("age")} />
              </label>
              <label>
                {t("性别设定", "Gender")}
                <select {...f("gender")}>
                  <option value="woman">{t("女性", "Woman")}</option>
                  <option value="man">{t("男性", "Man")}</option>
                  <option value="nonbinary">{t("非二元", "Nonbinary")}</option>
                </select>
              </label>
            </div>
            <label>
              {t("性格与气质", "Personality & presence")}
              <input
                required
                placeholder={t(
                  "温柔、独立，带一点文艺气质",
                  "Gentle, independent, with a creative spirit",
                )}
                {...f("personalityZh")}
              />
            </label>
            <label>
              {t("英文气质描述", "English personality")}
              <input
                placeholder="Gentle, independent, creative"
                {...f("personalityEn")}
              />
            </label>
            <label>
              {t("外貌与创作方向", "Appearance & creative direction")}
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t(
                  "短发、自然妆容、真实皮肤质感。穿米色针织衫，适合生活方式内容。",
                  "Short hair, natural makeup, realistic skin. An ivory knit sweater, suited to lifestyle stories.",
                )}
              />
            </label>
            {depth === "full" && (
              <>
                <label>
                  {t("人物背景", "Background")}
                  <textarea rows={3} {...f("backgroundZh")} />
                </label>
                <label>
                  {t("英文背景", "English background")}
                  <textarea rows={3} {...f("backgroundEn")} />
                </label>
                <label>
                  {t("不可改变的身份特征", "Identity anchors")}
                  <textarea rows={2} {...f("anchorsZh")} />
                </label>
                <label>
                  {t("英文身份特征", "English identity anchors")}
                  <textarea rows={2} {...f("anchorsEn")} />
                </label>
              </>
            )}
            <div className="form-grid">
              <label>
                {t("拟定授权", "Proposed license")}
                <select {...f("license")}>
                  <option value="negotiation">
                    {t("需洽谈授权", "License on request")}
                  </option>
                  <option value="noncommercial">
                    {t("非商业使用", "Noncommercial")}
                  </option>
                  <option value="commercial">
                    {t("商业内容", "Commercial content")}
                  </option>
                </select>
              </label>
              <div className="permission-checks">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.commercial}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, commercial: e.target.checked }))
                    }
                  />
                  {t("允许商业内容", "Commercial content allowed")}
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.brand}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, brand: e.target.checked }))
                    }
                  />
                  {t("允许品牌广告", "Brand ads allowed")}
                </label>
              </div>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enrich}
                onChange={(e) => setEnrich(e.target.checked)}
              />
              {t(
                "AI 完善背景与英文人设（包含在候选阶段报价内，可编辑）",
                "AI background and English profile (included in candidate quote, editable)",
              )}
            </label>
            <div className="form-footer">
              <small>
                <ShieldIcon />
                {t(
                  "默认私人保存，投稿审核后才公开",
                  "Private by default. Publication requires review.",
                )}
              </small>
              <button className="primary" disabled={busy}>
                {t("保存人设，查看生成报价", "Save profile & get a quote")}
                <ArrowRight size={17} />
              </button>
            </div>
            {draft && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  prepare({
                    kind: "candidates",
                    character_id: draft.id,
                    prompt,
                  })
                }
              >
                {t("继续已保存的角色", "Continue saved character")}
              </button>
            )}
          </form>
          <aside className="studio-aside">
            <div className="studio-preview">
              <div className="studio-preview-art" aria-hidden="true">
                ✳
              </div>
              <span>YOUR NEXT MUSE</span>
            </div>
            <div className="workflow-list">
              {[
                [
                  t("确认面孔", "Choose a face"),
                  t(
                    "从候选图中找到人物身份",
                    "Select the identity that fits your story",
                  ),
                ],
                [
                  t("完善角色卡", "Build reference views"),
                  t(
                    "正面、背面、侧面各自独立",
                    "Separate front, back and side references",
                  ),
                ],
                [
                  t("探索更多造型", "Explore their wardrobe"),
                  t(
                    "衣服可以变化，人物身份不变",
                    "A new outfit, the same character",
                  ),
                ],
              ].map(([title, desc], i) => (
                <div key={title}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="https://github.com/wuyinhust/vibe-casting"
              target="_blank"
              rel="noreferrer"
              className="method-credit"
            >
              Creative methodology by vibe-casting ↗
            </a>
          </aside>
        </div>
      ) : mode === "tryon" ? (
        <div className="tryon-layout">
          <section className="panel">
            <h2>{t("选择你的数字达人", "Select your talent")}</h2>
            <label>
              {t("角色", "Character")}
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">{t("选择角色", "Choose a character")}</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {local(c.name, locale)}
                  </option>
                ))}
              </select>
            </label>
            {character && (
              <>
                <Portrait character={character} className="tryon-portrait" />
                <label>
                  {t("参考造型", "Reference look")}
                  <select
                    value={lookId}
                    onChange={(e) => setLookId(e.target.value)}
                  >
                    {character.looks.map((l: Data) => (
                      <option key={l.id} value={l.id}>
                        {local(l.name, locale)}
                        {l.package_id ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </section>
          <section className="panel">
            <h2>{t("为 TA 换一套衣服", "A new look, same person")}</h2>
            <p className="muted">
              {t(
                "上传平铺、挂拍或模特上身的服装图片。清晰的正背面参考能帮助保留细节。",
                "Upload flat lays, hanging garments or model photos. Clear front and back references improve detail fidelity.",
              )}
            </p>
            <label>
              {t("本次上传的参考方向", "Reference direction for this upload")}
              <select
                value={garmentView}
                onChange={(e) => setGarmentView(e.target.value)}
              >
                <option value="front">{t("正面", "Front")}</option>
                <option value="back">{t("背面", "Back")}</option>
              </select>
            </label>
            <label className="upload-zone">
              <Upload size={28} />
              <strong>
                {t("点击上传服装参考", "Upload garment references")}
              </strong>
              <span>
                PNG, JPG, WEBP · 20 MB · {t("最多 6 张", "up to 6 images")}
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => upload(e.target.files)}
                disabled={busy}
              />
            </label>
            <div className="garment-list">
              {garments.map((g) => (
                <div key={g.id}>
                  <img src={`/api/v1/assets/${g.id}`} alt="Garment reference" />
                  <button
                    className="text-button"
                    onClick={() =>
                      setGarments((v) => v.filter((a) => a.id !== g.id))
                    }
                  >
                    {t("移除", "Remove")}
                  </button>
                </div>
              ))}
            </div>
            <label>
              {t("替换范围", "Replace")}
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="outfit">{t("整套搭配", "Entire outfit")}</option>
                <option value="top">{t("仅上装", "Top only")}</option>
                <option value="bottom">{t("仅下装", "Bottom only")}</option>
              </select>
            </label>
            <label>
              {t("造型说明", "Styling direction")}
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t(
                  "保留原发型和身材比例，替换为参考图中的服装。",
                  "Preserve the hair and body proportions. Match the reference outfit.",
                )}
              />
            </label>
            <button
              className="primary full"
              disabled={busy || !selected || !lookId || !garments.length}
              onClick={() =>
                prepare({
                  kind: "tryon",
                  character_id: selected,
                  look_id: lookId,
                  garment_ids: garments.map((g) => g.id),
                  scope,
                  prompt,
                })
              }
            >
              <Shirt size={18} />
              {t("生成正面预览 · 查看报价", "Preview the front · Get quote")}
            </button>
            <small className="muted">
              {t(
                "预览确认后再生成背面和侧面，每个阶段单独报价。",
                "Approve the front before generating back and side views. Each stage has its own quote.",
              )}
            </small>
          </section>
        </div>
      ) : !user ? (
        <Empty
          icon={UserRound}
          title={t("登录查看生成记录", "Sign in to view your creations")}
          description={t(
            "你的角色和造型任务会保存在这里。",
            "Your character and wardrobe jobs will appear here.",
          )}
          action={t("登录", "Sign in")}
          onAction={requireLogin}
        />
      ) : !jobs.length ? (
        <Empty
          icon={Layers}
          title={t(
            "给你的第一个角色一个开始",
            "Your first character starts here",
          )}
          description={t(
            "完成人物设定后，生成的候选图和角色卡会出现在这里。",
            "Save a profile to begin. Generated candidates and reference cards appear here.",
          )}
        />
      ) : (
        <div className="jobs-list">
          {jobs.map((job) => (
            <article className="panel job-card" key={job.id}>
              <div className="job-heading">
                <div>
                  <strong>
                    {
                      (
                        {
                          candidates: t("候选面孔", "Identity candidates"),
                          views: t("角色多视图", "Reference views"),
                          tryon: t("换装预览", "Wardrobe preview"),
                          "complete-look": t("完整造型", "Complete look"),
                          redo: t("视图重做", "View revision"),
                          showcase: t("展示照片", "Editorial showcase"),
                        } as any
                      )[job.kind]
                    }
                  </strong>
                  <small>
                    {new Date(job.created_at).toLocaleString(
                      locale === "zh" ? "zh-CN" : "en-US",
                    )}
                  </small>
                </div>
                <span className={`status status-${job.status}`}>
                  {(
                    {
                      queued: t("排队中", "Queued"),
                      running: t("生成中", "Generating"),
                      review: t("待确认", "Review"),
                      succeeded: t("已保存", "Saved"),
                      failed: t(
                        "失败，积分已解冻",
                        "Failed · credits released",
                      ),
                    } as any
                  )[job.status] || job.status}
                </span>
              </div>
              <ErrorBox message={job.error || ""} />
              {job.output.suggested_profile && (
                <div className="panel">
                  <h3>
                    {t(
                      "AI 建议人设 · 确认前可编辑",
                      "Suggested profile · Edit before confirming",
                    )}
                  </h3>
                  {(["personality", "background"] as const).map((field) => (
                    <div key={field}>
                      {(["zh", "en"] as const).map((lang) => (
                        <label key={lang}>
                          {field === "personality"
                            ? t("性格", "Personality")
                            : t("背景", "Background")}{" "}
                          · {lang.toUpperCase()}
                          <textarea
                            rows={3}
                            disabled={job.status !== "review"}
                            value={
                              (profileEdits[job.id] ||
                                job.output.suggested_profile)[field][lang]
                            }
                            onChange={(e) =>
                              setProfileEdits((v) => {
                                const p =
                                  v[job.id] || job.output.suggested_profile;
                                return {
                                  ...v,
                                  [job.id]: {
                                    ...p,
                                    [field]: {
                                      ...p[field],
                                      [lang]: e.target.value,
                                    },
                                  },
                                };
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="job-images">
                {(
                  job.output.candidate_ids ||
                  job.output.asset_ids ||
                  [job.output.showcase_asset_id].filter(Boolean)
                ).map((id: string) => (
                  <div key={id}>
                    <a
                      href={`/api/v1/assets/${id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/v1/assets/${id}`}
                        alt={t("生成结果", "Generated result")}
                      />
                    </a>
                    {job.kind === "candidates" && job.status === "review" && (
                      <button
                        className="secondary full"
                        disabled={busy}
                        onClick={() => approve(job, id)}
                      >
                        <Check size={15} />
                        {t("选择这个身份", "Choose identity")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="job-actions">
                <small>
                  {job.quote} {t("积分", "credits")}
                  {job.status === "queued" || job.status === "running"
                    ? t("已冻结", " reserved")
                    : ""}
                </small>
                {job.status === "review" && job.kind !== "candidates" && (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={!!reviewed[job.id]}
                      onChange={(e) =>
                        setReviewed((v) => ({
                          ...v,
                          [job.id]: e.target.checked,
                        }))
                      }
                    />
                    {t(
                      "已核对脸部、年龄感、体型和服装细节",
                      "I checked the face, apparent age, body proportions and garment details",
                    )}
                  </label>
                )}
                {job.status === "review" && job.kind !== "candidates" && (
                  <button
                    className="primary"
                    disabled={busy || !reviewed[job.id]}
                    onClick={() => approve(job)}
                  >
                    <Check size={16} />
                    {t("确认结果", "Approve result")}
                  </button>
                )}
                {job.kind === "tryon" && job.status === "succeeded" && (
                  <button
                    className="primary"
                    onClick={() =>
                      prepare({
                        kind: "complete-look",
                        character_id: job.input.character_id,
                        look_id: job.output.look_id,
                        prompt: job.input.prompt,
                      })
                    }
                  >
                    {t("补齐背面与侧面", "Generate back & side")}
                    <ArrowRight size={15} />
                  </button>
                )}
                {job.output.look_id &&
                  ["review", "succeeded"].includes(job.status) && (
                    <select
                      aria-label={t("重做指定视图", "Redo a view")}
                      value=""
                      onChange={(e) => {
                        if (e.target.value)
                          prepare({
                            kind: "redo",
                            role: e.target.value,
                            character_id: job.input.character_id,
                            look_id: job.output.look_id,
                            prompt,
                          });
                      }}
                    >
                      <option value="">
                        {t("重做指定视图…", "Redo a view…")}
                      </option>
                      <option value="front">{t("正面", "Front")}</option>
                      <option value="back">{t("背面", "Back")}</option>
                      <option value="side">{t("侧面", "Side")}</option>
                    </select>
                  )}
                {job.status === "succeeded" &&
                  !["candidates", "tryon", "showcase"].includes(job.kind) && (
                    <>
                      <button
                        className="secondary"
                        onClick={() =>
                          prepare({
                            kind: "showcase",
                            character_id: job.input.character_id,
                            look_id: job.output.look_id,
                            prompt,
                          })
                        }
                      >
                        <ImageIcon size={15} />
                        {t("生成展示图", "Create showcase")}
                      </button>
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            await post(
                              `characters/${job.input.character_id}/submit`,
                              { look_id: job.output.look_id },
                            );
                            notify(t("已提交审核", "Submitted for review"));
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {t("投稿到公共库", "Submit to catalog")}
                      </button>
                      <button
                        className="text-button"
                        onClick={() => openCharacter(job.input.character_id)}
                      >
                        {t("查看角色", "View character")}
                      </button>
                    </>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}
      {quote && (
        <Modal
          onClose={() => setQuote(null)}
          label={t("生成报价", "Generation quote")}
        >
          <div className="dialog-form">
            <div className="eyebrow">CREATION QUOTE</div>
            <h2>{t("为下一步创作准备好了。", "Ready for the next step.")}</h2>
            <div className="quote-number">
              {quote.price.credits}
              <span>{t("积分", "credits")}</span>
            </div>
            <p>
              {t(
                "提交后冻结积分，生成成功交付后扣除。技术失败会解冻；不满意的重做属于新任务。",
                "Credits are reserved on submission and charged on delivery. Technical failures release the reservation; creative revisions are new jobs.",
              )}
            </p>
            {!quote.price.generation_available && (
              <div className="notice">
                {t(
                  "当前未配置 OpenAI 生图服务，不能提交付费任务。",
                  "OpenAI generation is not configured. This task cannot be submitted yet.",
                )}
              </div>
            )}
            <ErrorBox message={error} />
            <button
              className="primary full"
              disabled={busy || !quote.price.generation_available}
              onClick={generate}
            >
              {t("确认并生成", "Confirm & generate")}
              <Sparkles size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function ShieldIcon() {
  return <Check size={13} />;
}
