"use client";
import { useEffect, useState } from "react";
import { Data, api, post, useApp, Modal, ErrorBox } from "./ui";

export function ProfileEditor({
  character,
  onClose,
}: {
  character: Data;
  onClose: () => void;
}) {
  const { t, notify, cap } = useApp();
  const [profile, setProfile] = useState(character),
    [revisions, setRevisions] = useState<Data[]>([]),
    [saved, setSaved] = useState<Data | null>(null),
    [price, setPrice] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`characters/${character.id}/revisions`)
      .then((d) => setRevisions(d.items))
      .catch((e) => setError(e.message));
  }, [character.id]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await post(`characters/${character.id}/revisions`, profile);
      setSaved(d);
      setProfile(d);
      setRevisions((v) => [{ version: d.identity_version, snapshot: d }, ...v]);
      setPrice(await post("generation-jobs/quote", { kind: "candidates" }));
      notify(
        t(
          "私人身份版本已保存，公开版本保持稳定",
          "Private identity version saved. Published version remains stable.",
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate() {
    if (!saved || !price) return;
    setBusy(true);
    try {
      await post("generation-jobs", {
        kind: "candidates",
        character_id: character.id,
        identity_version: saved.identity_version,
        idempotency_key: crypto.randomUUID(),
        expected_price_version: price.version,
        expected_credits: price.credits,
      });
      notify(
        t(
          "已提交；请在工作室的生成记录中继续",
          "Submitted. Continue in Studio → Generation history.",
        ),
      );
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose} label={t("修订人设", "Revise character profile")}>
      <form className="dialog-form" onSubmit={save}>
        <h2>{t("完善这个人的故事", "Refine their story")}</h2>
        <p>
          {t(
            "每次保存新增私人身份版本。旧角色包继续引用原版本；新版本需重新生成并审核后公开。",
            "Each save creates a private identity version. Existing packages keep their original identity. A new version needs generation and review before publication.",
          )}
        </p>
        {revisions.length > 0 && (
          <label>
            {t("以已有版本为基础", "Start from a saved version")}
            <select
              value={profile.identity_version}
              onChange={(e) => {
                const r = revisions.find(
                  (r) => r.version === Number(e.target.value),
                );
                if (r) {
                  setProfile(r.snapshot);
                  setSaved({ ...r.snapshot, identity_version: r.version });
                  setPrice(null);
                }
              }}
            >
              {revisions.map((r) => (
                <option key={r.version} value={r.version}>
                  v{r.version}
                </option>
              ))}
            </select>
          </label>
        )}
        {(["name", "personality", "background", "anchors"] as const).map(
          (key) => (
            <div key={key}>
              {(["zh", "en"] as const).map((lang) => (
                <label key={lang}>
                  {
                    {
                      name: t("姓名", "Name"),
                      personality: t("性格", "Personality"),
                      background: t("背景", "Background"),
                      anchors: t("身份特征", "Identity anchors"),
                    }[key]
                  }{" "}
                  · {lang.toUpperCase()}
                  <textarea
                    required
                    rows={key === "name" ? 1 : 3}
                    value={profile[key]?.[lang] || ""}
                    onChange={(e) => {
                      setProfile((p) => ({
                        ...p,
                        [key]: { ...p[key], [lang]: e.target.value },
                      }));
                      setSaved(null);
                      setPrice(null);
                    }}
                  />
                </label>
              ))}
            </div>
          ),
        )}
        <label>
          {t("年龄设定", "Character age")}
          <input
            required
            type="number"
            min={1}
            max={110}
            value={profile.age}
            onChange={(e) => {
              setProfile((p) => ({ ...p, age: Number(e.target.value) }));
              setSaved(null);
            }}
          />
        </label>
        <ErrorBox message={error} />
        <button className="primary full" disabled={busy}>
          {t("保存为新身份版本", "Save a new identity version")}
        </button>
        {saved && !price && (
          <button
            type="button"
            className="secondary full"
            onClick={async () => {
              try {
                setPrice(
                  await post("generation-jobs/quote", { kind: "candidates" }),
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {t("查看生成报价", "Get generation quote")}
          </button>
        )}
        {saved && price && (
          <button
            type="button"
            className="secondary full"
            disabled={busy || !cap.generation}
            onClick={generate}
          >
            {t(
              "确认报价并生成候选面孔",
              "Confirm quote & generate candidate faces",
            )}{" "}
            · {price.credits} {t("积分", "credits")}
          </button>
        )}
      </form>
    </Modal>
  );
}
