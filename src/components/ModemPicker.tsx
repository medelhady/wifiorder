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

const head: React.CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#f3f4f6",
  padding: "8px 10px",
  textAlign: "right",
  fontSize: 13,
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
};

const cell: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #eee",
  fontSize: 13,
  whiteSpace: "nowrap",
};

// Codes are Latin letters and digits inside an Arabic page: each one sits in its own cell, written
// left to right, so the number in front of it can never run into it.
const code: React.CSSProperties = {
  direction: "ltr",
  unicodeBidi: "isolate",
  display: "inline-block",
  fontFamily: "ui-monospace, Consolas, monospace",
};

// نافذة اختيار مودم من المودمات غير المستعملة: جدول مرتب مع بحث
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
          maxWidth: 680,
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
            <span>
              المودم الحالي: <span style={code}>{current}</span>
            </span>
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

        {shown.length === 0 ? (
          <p style={{ margin: 0, color: "#666" }}>
            {modems.length === 0 ? "لا توجد مودمات متبقية." : "لا توجد نتائج."}
          </p>
        ) : (
          <div
            style={{
              overflow: "auto",
              border: "1px solid #ddd",
              borderRadius: 8,
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={head}>#</th>
                  <th style={head}>SN (الكود)</th>
                  <th style={head}>PROD ID</th>
                  <th style={head}>MAC</th>
                  {showOwner && <th style={head}>تبع</th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((m) => (
                  <tr
                    key={m.code}
                    onClick={() => onPick(m.code)}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#eff6ff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ ...cell, color: "#666" }}>{m.seq}</td>
                    <td style={{ ...cell, fontWeight: 700 }}>
                      <span style={code}>{m.code}</span>
                    </td>
                    <td style={cell}>
                      <span style={code}>{m.prod_id || "—"}</span>
                    </td>
                    <td style={cell}>
                      <span style={code}>{m.mac || "—"}</span>
                    </td>
                    {showOwner && (
                      <td style={{ ...cell, color: "#2563eb" }}>
                        {m.owner ?? "مشترك"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {matches.length > shown.length && (
          <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
            يظهر أول 200 فقط. استخدم البحث لتضييق القائمة.
          </p>
        )}
      </div>
    </div>
  );
}
