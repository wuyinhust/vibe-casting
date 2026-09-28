"use client";
import { useApp, type Data } from "./ui";
export function TalentLeads({ items }: { items: Data[] }) {
  const { t } = useApp();
  return (
    <section className="panel account-section talent-leads">
      <h2>
        {t("达人合作候选库", "Talent prospect library")} · {items.length}
      </h2>
      <p className="muted">
        {t(
          "仅运营可见。账号、关联人物及历史数据来自导入资料，尚未独立核实；未提供图片或授权，不进入公开选角与下载库。",
          "Staff only. Imported accounts, character labels and historical metrics are unverified. Images and usage rights are missing; these entries are not public casting assets.",
        )}
      </p>
      {!items.length && <p>{t("暂无导入候选。", "No imported prospects.")}</p>}
      {items.map((lead) => {
        const r = lead.payload;
        return (
          <details key={lead.id} className="talent-lead">
            <summary>
              <span>
                <strong>{lead.account_name}</strong>
                <small>
                  {lead.platform} · {r.character_label}
                </small>
              </span>
              <span className="lead-status">
                {t("待核实 · 待授权", "Unverified · Rights pending")}
              </span>
            </summary>
            <div className="lead-body">
              <dl>
                <div>
                  <dt>{t("账号", "Account")}</dt>
                  <dd>{r.account_handle}</dd>
                </div>
                <div>
                  <dt>{t("关联角色／原表标签", "Character / source label")}</dt>
                  <dd>{r.character_label}</dd>
                </div>
                <div>
                  <dt>
                    {t("原表分类与状态", "Source classification / status")}
                  </dt>
                  <dd>
                    {r.persona_type} · {r.source_status}
                  </dd>
                </div>
                <div>
                  <dt>{t("记录日期", "Recorded on")}</dt>
                  <dd>{lead.observed_on}</dd>
                </div>
                <div>
                  <dt>{t("原表粉丝数", "Reported followers")}</dt>
                  <dd>{r.reported_followers.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>
                    {t(
                      "原表互动数（口径待核实）",
                      "Reported engagement (definition unverified)",
                    )}
                  </dt>
                  <dd>{r.reported_engagement.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t("原表作品数", "Reported posts")}</dt>
                  <dd>
                    {r.reported_posts == null
                      ? t("未提供", "Not supplied")
                      : r.reported_posts}
                  </dd>
                </div>
              </dl>
              <a
                className="text-button"
                href={lead.profile_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("打开原始账号主页 ↗", "Open original profile ↗")}
              </a>
              <p className="lead-notes">{r.source_notes}</p>
              {r.review_flags.length > 0 && (
                <ul>
                  {r.review_flags.map((flag: string) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              )}
              <p className="muted">
                {t(
                  "上架还需：确认账号与角色对应关系、提供授权图片和许可范围、补齐角色人设及素材。",
                  "Before listing: verify account and character mapping, obtain images and usage rights, and complete the character profile and assets.",
                )}
              </p>
            </div>
          </details>
        );
      })}
    </section>
  );
}
