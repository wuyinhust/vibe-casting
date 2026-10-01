"use client";
import { createContext, useContext, useEffect, useRef } from "react";
import { X, Loader2, ArrowUpRight } from "lucide-react";
export type Data = Record<string, any>;
export type Locale = "zh" | "en";
export type AppContextValue = {
  locale: Locale;
  t: (zh: string, en: string) => string;
  user: Data | null;
  cap: Data;
  wallet: Data | null;
  notify: (message: string) => void;
  requireLogin: () => boolean;
  refreshMe: () => Promise<void>;
  navigate: (view: string) => void;
  openCharacter: (id: string) => void;
};
export const AppContext = createContext<AppContextValue>(null!);
export const useApp = () => useContext(AppContext);
export async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const r = await fetch(`/api/v1/${path}`, { ...options, headers });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || "Request failed");
  return data;
}
export const post = (path: string, data: unknown = {}) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export const patch = (path: string, data: unknown) =>
  api(path, { method: "PATCH", body: JSON.stringify(data) });
export const local = (v: any, l: Locale) =>
  typeof v === "string" ? v : v?.[l] || v?.en || v?.zh || "";
export function Portrait({
  character,
  className = "",
  style = {},
  onClick,
}: {
  character: Data;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return character.cover &&
    character.sprite_index !== null &&
    character.sprite_index !== undefined ? (
    <svg
      role="img"
      aria-label={character.name?.en || "Character"}
      onClick={onClick}
      className={`portrait ${className}`}
      style={style}
      // Each tile in the 1536 × 1024 editorial sheet is 384 × 512.
      // SVG slice uses one scale factor, even in square or wide containers.
      viewBox={`${(character.sprite_index % 4) * 384} ${Math.floor(character.sprite_index / 4) * 512} 384 512`}
      preserveAspectRatio="xMidYMin slice"
    >
      <image
        href={character.cover}
        width="1536"
        height="1024"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  ) : character.cover ? (
    <img
      className={`portrait ${className}`}
      src={character.cover}
      alt={character.name?.en || "Character"}
      style={style}
      onClick={onClick}
    />
  ) : (
    <div
      className={`portrait portrait-empty ${className}`}
      style={style}
      onClick={onClick}
    >
      <span>{character.name?.en?.slice(0, 1) || "a"}</span>
    </div>
  );
}
export function Modal({
  children,
  onClose,
  wide = false,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const els = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
          ),
        );
        if (!els.length) return;
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <button
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={21} />
        </button>
        {children}
      </div>
    </div>
  );
}
export function Empty({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: any;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={30} strokeWidth={1.4} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && (
        <button className="primary" onClick={onAction}>
          {action}
          <ArrowUpRight size={17} />
        </button>
      )}
    </div>
  );
}
export function Spinner() {
  return (
    <div className="loading">
      <Loader2 className="spin" size={24} />
    </div>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return message ? (
    <div role="alert" className="error-box">
      {message}
    </div>
  ) : null;
}
export async function download(url: string, filename: string) {
  const r = await fetch(url);
  if (!r.ok) {
    const d = await r.json();
    throw new Error(d.error?.message || "Download failed");
  }
  const blob = await r.blob(),
    href = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
