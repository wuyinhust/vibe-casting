"use client";
import { useCallback, useEffect, useState } from "react";
import {
  api,
  post,
  useApp,
  local,
  ErrorBox,
  Spinner,
  Modal,
  type Data,
} from "./ui";
const labels: Record<string, [string, string]> = {
  production: ["创作过程", "Creation evidence"],
  identity: ["主体身份", "Registrant identity"],
  rights_holder: ["权利来源", "Rights provenance"],
  display: ["展示许可", "Display permission"],
  download: ["素材分发", "Asset distribution"],
  adaptation: ["改编与换装", "Adaptation & wardrobe"],
  commercial: ["商业内容", "Commercial content"],
  brand: ["品牌合作", "Brand collaboration"],
  sublicense: ["再许可", "Sublicensing"],
  official_registration: ["外部作品登记", "External work registration"],
};
const states: Record<string, [string, string]> = {
  missing: ["未提交", "Not submitted"],
  submitted: ["待审核", "Pending review"],
  approved: ["材料已核验", "Evidence reviewed"],
  rejected: ["已退回", "Returned"],
  revoked: ["已撤回", "Revoked"],
  expired: ["已到期", "Expired"],
  scheduled: ["尚未生效", "Not yet effective"],
};
export function AssetPassport({
  subjectType = "characters",
  subjectId,
  version,
  lookId,
}: {
  subjectType?: string;
  subjectId: string;
  version?: number;
  lookId?: string;
}) {
  const { t, locale } = useApp();
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState<string[]>([]);
  const base = `passports/${subjectType}/${encodeURIComponent(subjectId)}`;
  const load = useCallback(async () => {
    const q = new URLSearchParams();
    if (version) q.set("identity_version", String(version));
    if (lookId) q.set("look_id", lookId);
    setData(await api(`${base}?${q}`));
  }, [base, version, lookId]);
  useEffect(() => {
    setData(null);
    setError("");
    setSelected([]);
    load().catch((e) => setError(e.message));
  }, [load]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const date = (key: string) =>
        f.get(key) ? new Date(String(f.get(key))).toISOString() : null;
      await post(`${base}/claims`, {
        kind: f.get("kind"),
        identity_version: data!.identity_version,
        look_id: f.get("look_scope") ? lookId : null,
        title: f.get("title"),
        declarant: f.get("declarant"),
        private_notes: f.get("private_notes"),
        public_summary: f.get("public_summary"),
        claimed_created_at: f.get("claimed_created_at") || null,
        valid_from: date("valid_from"),
        valid_until: date("valid_until"),
        evidence_ids: selected,
      });
      form.reset();
      setSelected([]);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="asset-passport">
      <div className="passport-heading">
        <span>AVIBE ASSET PASSPORT</span>
        <h2>{t("数字达人资产护照", "Digital talent asset passport")}</h2>
      </div>
      <ErrorBox message={error} />
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="passport-number">
            <strong>{data.number}</strong>
            <span>
              {t("身份版本", "Identity version")} v{data.identity_version}
            </span>
          </div>
          <p className="muted">
            {t("平台登记时间", "Platform registration time")}：
            {new Date(data.registered_at).toLocaleString(
              locale === "zh" ? "zh-CN" : "en-US",
            )}
          </p>
          {data.subject_type === "candidate_account" && (
            <p className="notice">
              {t(
                "候选账号档案：尚未关联正式人物资产。",
                "Candidate account record: not yet linked to a character asset.",
              )}
            </p>
          )}
          <p className="passport-notice">
            {t(
              "这是 AVIBE 平台登记与材料审核记录，不是官方版权证书，也不单独授予使用权。具体使用范围以角色包许可及有效合同为准。",
              "This is an AVIBE registration and evidence review record, not an official copyright certificate or a standalone license. Consult the package license and applicable agreements.",
            )}
          </p>
          <div className="passport-status-grid">
            {data.statuses.map((s: Data) => (
              <div
                key={s.kind}
                className={`passport-status ${s.status === "approved" ? "reviewed" : ""}`}
              >
                <strong>{t(...labels[s.kind])}</strong>
                <span>{t(...(states[s.status] || states.missing))}</span>
                {s.summary && <p>{s.summary}</p>}
                {s.valid_until && (
                  <small>
                    {t("截至", "Until")}{" "}
                    {new Date(s.valid_until).toLocaleDateString()}
                  </small>
                )}
              </div>
            ))}
          </div>
          <details className="passport-detail">
            <summary>
              {t("资产版本与文件指纹", "Asset versions & file fingerprints")} ·{" "}
              {data.assets.length}
            </summary>
            {data.assets.length ? (
              data.assets.map((a: Data) => (
                <div className="fingerprint" key={a.id}>
                  <strong>
                    {a.role} · {t("造型", "Look")} v{a.look_version}
                  </strong>
                  <small>
                    {a.width} × {a.height} · {a.bytes.toLocaleString()} bytes
                  </small>
                  <code>{a.sha256}</code>
                </div>
              ))
            ) : (
              <p className="muted">
                {t(
                  "该版本暂无可列出的角色素材。",
                  "No character assets listed for this version.",
                )}
              </p>
            )}
          </details>
          <button
            className="secondary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${data.number}${data.can_manage ? "-private" : ""}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            {data.can_manage
              ? t(
                  "导出完整档案（含私密材料记录）",
                  "Export full record (includes private metadata)",
                )
              : t("导出公开登记摘要", "Export public registration summary")}
          </button>
          {data.can_manage && (
            <>
              <details className="passport-detail">
                <summary>
                  {t(
                    "提交创作或授权材料",
                    "Submit creation or rights evidence",
                  )}
                </summary>
                <p className="muted">
                  {t(
                    "证明文件、声明人和原始记录仅本人及运营可见；审核通过的公开摘要会显示给访客，请勿在摘要填写隐私信息。",
                    "Files, declarant details and original records stay private to the owner and staff. Approved public summaries are visible to visitors; omit personal information.",
                  )}
                </p>
                <label className="passport-upload">
                  {t(
                    "上传原始证明（PDF / PNG / JPEG / TXT / JSON，最大 10 MB）",
                    "Upload original evidence (PDF / PNG / JPEG / TXT / JSON, max 10 MB)",
                  )}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.json"
                    disabled={busy}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setBusy(true);
                      setError("");
                      try {
                        const form = new FormData();
                        form.set("file", file);
                        const r = await api(`${base}/evidence`, {
                          method: "POST",
                          body: form,
                        });
                        setSelected((s) => [...s, r.id]);
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <form className="passport-form" onSubmit={submit}>
                  <label>
                    {t("材料类型", "Record type")}
                    <select name="kind">
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {t(...v)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("材料标题（私密）", "Record title (private)")}
                    <input
                      name="title"
                      required
                      minLength={2}
                      maxLength={200}
                    />
                  </label>
                  <label>
                    {t(
                      "声明人／权利主体（私密）",
                      "Declarant / rights holder (private)",
                    )}
                    <input name="declarant" required maxLength={200} />
                  </label>
                  <label>
                    {t(
                      "创作贡献、来源或授权条款（私密）",
                      "Creative contribution, provenance or agreement terms (private)",
                    )}
                    <textarea
                      name="private_notes"
                      required
                      minLength={5}
                      maxLength={10000}
                      rows={4}
                    />
                  </label>
                  <label>
                    {t(
                      "审核后公开的范围摘要",
                      "Scope summary published after approval",
                    )}
                    <textarea
                      name="public_summary"
                      required
                      minLength={2}
                      maxLength={600}
                      rows={2}
                      placeholder={t(
                        "例如：仅限 AVIBE 展示该版本形象，不含分发原图或广告使用。",
                        "Example: AVIBE may display this version; source distribution and advertising excluded.",
                      )}
                    />
                  </label>
                  <label>
                    {t(
                      "声明的创作日期（可选，不等同平台记录时间）",
                      "Claimed creation date (optional, separate from receipt time)",
                    )}
                    <input name="claimed_created_at" type="date" />
                  </label>
                  <div className="passport-dates">
                    <label>
                      {t("生效时间（可选）", "Effective from (optional)")}
                      <input name="valid_from" type="datetime-local" />
                    </label>
                    <label>
                      {t("截止时间（可选）", "Expires at (optional)")}
                      <input name="valid_until" type="datetime-local" />
                    </label>
                  </div>
                  {lookId && (
                    <label className="passport-check">
                      <input type="checkbox" name="look_scope" />
                      {t(
                        "仅适用于当前造型（否则适用当前身份版本）",
                        "Limit to selected look (otherwise applies to this identity version)",
                      )}
                    </label>
                  )}
                  <fieldset>
                    <legend>{t("关联证明文件", "Supporting evidence")}</legend>
                    {data.evidence.length === 0 ? (
                      <p className="muted">
                        {t(
                          "可先提交说明；核验通过前必须补充证明文件并重新提交记录。",
                          "You can submit a statement first; evidence files are required for approval. Submit a new record once files are available.",
                        )}
                      </p>
                    ) : (
                      data.evidence.map((f: Data) => (
                        <label className="passport-check" key={f.id}>
                          <input
                            type="checkbox"
                            checked={selected.includes(f.id)}
                            onChange={(e) =>
                              setSelected((s) =>
                                e.target.checked
                                  ? [...s, f.id]
                                  : s.filter((id) => id !== f.id),
                              )
                            }
                          />
                          <span>{f.filename}</span>
                        </label>
                      ))
                    )}
                  </fieldset>
                  <button className="primary" disabled={busy}>
                    {busy
                      ? t("处理中…", "Working…")
                      : t("提交核验", "Submit for review")}
                  </button>
                </form>
              </details>
              <details className="passport-detail">
                <summary>
                  {t(
                    "证明文件与提交记录（私密）",
                    "Evidence & submissions (private)",
                  )}{" "}
                  · {data.claims.length}
                </summary>
                {data.evidence.map((f: Data) => (
                  <div className="fingerprint" key={f.id}>
                    <a href={`/api/v1/passports/evidence/${f.id}`} download>
                      {f.filename}
                    </a>
                    <code>{f.sha256}</code>
                    <small>
                      {t("平台收到于", "Received")}{" "}
                      {new Date(f.received_at).toLocaleString()}
                    </small>
                  </div>
                ))}
                {data.claims.map((c: Data) => (
                  <article className="passport-claim" key={c.id}>
                    <strong>{c.title}</strong>
                    <p>
                      {t(...labels[c.kind])} ·{" "}
                      {t(...(states[c.effective_status] || states.missing))}
                    </p>
                    <p>{c.declarant}</p>
                    <p className="preserve-text">{c.private_notes}</p>
                    {c.claimed_created_at && (
                      <small>
                        {t("声明创作日期", "Claimed creation date")}：
                        {String(c.claimed_created_at).slice(0, 10)}
                      </small>
                    )}
                    <p className="muted">
                      {t("提交时间", "Submitted")}：
                      {new Date(c.submitted_at).toLocaleString()}
                    </p>
                    {c.review_note && (
                      <p>
                        {t("审核意见", "Review note")}：{c.review_note}
                      </p>
                    )}
                    {data.can_review &&
                      ["submitted", "approved"].includes(c.status) && (
                        <form
                          className="passport-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            setBusy(true);
                            setError("");
                            try {
                              await post("admin/passports/review", {
                                claim_id: c.id,
                                status: f.get("status"),
                                note: f.get("note"),
                                expected_revision: c.revision,
                              });
                              await load();
                            } catch (e) {
                              setError((e as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          <select name="status">
                            {c.status === "approved" ? (
                              <option value="revoked">
                                {t("撤回核验", "Revoke review")}
                              </option>
                            ) : (
                              <>
                                <option value="rejected">
                                  {t("退回补充", "Return for clarification")}
                                </option>
                                <option value="approved">
                                  {t("材料核验通过", "Evidence reviewed")}
                                </option>
                              </>
                            )}
                          </select>
                          <textarea
                            name="note"
                            required
                            minLength={5}
                            maxLength={2000}
                            placeholder={t(
                              "核验了哪些材料、许可范围及限制（至少 5 字）",
                              "Record evidence checked, scope and limitations (at least 5 characters)",
                            )}
                          />
                          <button className="secondary" disabled={busy}>
                            {t("保存审核决定", "Save review decision")}
                          </button>
                        </form>
                      )}
                  </article>
                ))}
              </details>
              <details className="passport-detail">
                <summary>
                  {t(
                    "平台生成与操作记录（私密）",
                    "Platform generation & activity (private)",
                  )}
                </summary>
                <p className="muted">
                  {t(
                    "旧任务仅列出已保存的信息，不补造历史记录；当前未接入第三方可信时间戳。",
                    "Historical tasks show only previously recorded information. Missing history is not reconstructed. No independent timestamp service is connected.",
                  )}
                </p>
                <pre>
                  {JSON.stringify(
                    { generation_jobs: data.production, events: data.events },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
export function PassportAdmin() {
  const { t, locale } = useApp();
  const [subjects, setSubjects] = useState<Data[]>([]),
    [selected, setSelected] = useState<Data | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api("admin/passports")
      .then((d) => setSubjects(d.subjects))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <section className="panel account-section">
      <h2>
        {t("AVIBE 数字达人资产护照", "AVIBE Digital Talent Asset Passports")}
      </h2>
      <p className="muted">
        {t(
          "登记创作证据，分别核验主体与许可材料。审核不会自动发布角色或扩大下载权限。",
          "Register creation evidence and review identity and permissions separately. Reviews do not publish characters or expand download access.",
        )}
      </p>
      <ErrorBox message={error} />
      <label>
        {t("选择人物或候选账号", "Select a character or prospect")}
        <select
          className="passport-subject"
          value=""
          onChange={(e) =>
            setSelected(
              subjects.find((s) => `${s.type}/${s.id}` === e.target.value) ||
                null,
            )
          }
        >
          <option value="">{t("选择档案…", "Choose a record…")}</option>
          {subjects.map((s) => (
            <option key={`${s.type}/${s.id}`} value={`${s.type}/${s.id}`}>
              {s.type === "leads"
                ? t("候选账号", "Prospect")
                : t("角色", "Character")}{" "}
              · {local(s.name, locale)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <Modal
          wide
          label={t("数字达人资产护照", "Asset passport")}
          onClose={() => setSelected(null)}
        >
          <AssetPassport subjectType={selected.type} subjectId={selected.id} />
        </Modal>
      )}
    </section>
  );
}
