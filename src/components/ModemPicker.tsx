"use client";

import { useState } from "react";

export type Modem = {
  seq: number;
  code: string;
  prod_id?: string | null;
  sn?: string | null;
  mac?: string | null;
  owner?: string | null;
};

// نافذة اختيار مودم من المودمات غير المستعملة، مع بحث
export default function ModemPicker({
  modems,
  current,
  title,
  onPick,
  onClear,
  onClose,
  showOwner = false,
}: {
  modems: Modem[];
  current: string | null;
  title: string;
  onPick: (code: string) => void;
  onClear?: () => void;
  onClose: () => void;
  showOwner?: boolean;
}) {
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const matches = needle
    ? modems.filter(
        (m) =>
          m.code.toLowerCase().includes(needle) ||
          (m.prod_id ?? "").toLowerCase().includes(needle) ||
          (m.mac ?? "").toLowerCase().includes(needle) ||
          String(m.seq) === needle
      )
    : modems;
  const shown = matches.slice(0, 200);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 30,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: 20,
          width: "100%",
          maxWidth: 500,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "4px 12px", cursor: "pointer" }}
          >
            إغلاق ✕
          </button>
        </div>

        {current && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
              background: "#f3f4f6",
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 14,
            }}
          >
            <span>المودم الحالي: {current}</span>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                style={{ cursor: "pointer", color: "crimson" }}
              >
                إرجاع المودم
              </button>
            )}
          </div>
        )}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بـ SN أو PROD ID أو MAC أو الرقم"
          autoFocus
          style={{ padding: 10, fontSize: 16 }}
        />

        <div style={{ color: "#666", fontSize: 13 }}>
          المتاح: {modems.length}
          {needle ? ` — نتائج البحث: ${matches.length}` : ""}
        </div>

        <div style={{ overflowY: "auto", display: "grid", gap: 6 }}>
          {shown.length === 0 && (
            <p style={{ margin: 0, color: "#666" }}>
              {modems.length === 0
                ? "لا توجد مودمات متبقية."
                : "لا توجد نتائج."}
            </p>
          )}
          {shown.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => onPick(m.code)}
              style={{
                textAlign: "right",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                background: "#fff",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <div>
                <span style={{ color: "#666", marginInlineEnd: 8 }}>
                  #{m.seq}
                </span>
                <strong>{m.code}</strong>
                {showOwner && (
                  <span style={{ color: "#2563eb", fontSize: 12, marginInlineStart: 8 }}>
                    {m.owner ? `تبع: ${m.owner}` : "مشترك"}
                  </span>
                )}
              </div>
              {(m.prod_id || m.mac) && (
                <div style={{ color: "#666", fontSize: 12 }} dir="ltr">
                  {m.prod_id ? `PROD ID: ${m.prod_id}` : ""}
                  {m.prod_id && m.mac ? "  ·  " : ""}
                  {m.mac ? `MAC: ${m.mac}` : ""}
                </div>
              )}
            </button>
          ))}
          {matches.length > shown.length && (
            <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
              يظهر أول 200 فقط. استخدم البحث لتضييق القائمة.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
