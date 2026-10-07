"use client";

import { useCallback, useEffect, useState } from "react";
import ModemImportModal from "@/components/ModemImportModal";

type ModemRow = {
  seq: number;
  code: string;
  prod_id: string | null;
  sn: string | null;
  mac: string | null;
  owner: string | null;
  used_by_request?: string | null;
  used_request_number?: number | null;
  used_by_user?: string | null;
  used_at?: string | null;
};

type OwnerSummary = {
  owner: string | null;
  total: number;
  used: number;
  remaining: number;
};

type Filter = "all" | "unused" | "used";

const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "right",
  background: "#f3f4f6",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
  fontSize: 14,
};
const td: React.CSSProperties = {
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 14,
};

const PAGE_SIZE = 300;
const SHARED = "__shared__";

export default function ModemListPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [modems, setModems] = useState<ModemRow[]>([]);
  const [owners, setOwners] = useState<OwnerSummary[]>([]);
  const [counts, setCounts] = useState({ total: 0, used: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async () => {
    const meRes = await fetch("/api/me");
    if (meRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    const me = (await meRes.json()).user;
    const admin = me?.role === "admin";
    setIsAdmin(admin);

    const res = await fetch(admin ? "/api/modem-codes?all=1" : "/api/modem-codes");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "حدث خطأ");
      setLoading(false);
      return;
    }
    setModems(json.modems ?? []);
    setOwners(json.owners ?? []);
    setCounts({
      total: json.total ?? json.remaining ?? 0,
      used: json.used ?? 0,
      remaining: json.remaining ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(code: string) {
    if (!confirm(`حذف المودم ${code} من القائمة؟`)) return;
    const res = await fetch("/api/modem-codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? "حدث خطأ");
    }
    load();
  }

  const needle = q.trim().toLowerCase();
  const filtered = modems.filter((m) => {
    const used = !!m.used_by_request;
    if (filter === "unused" && used) return false;
    if (filter === "used" && !used) return false;
    if (ownerFilter === SHARED && m.owner) return false;
    if (ownerFilter && ownerFilter !== SHARED && m.owner !== ownerFilter) return false;
    if (!needle) return true;
    return (
      m.code.toLowerCase().includes(needle) ||
      (m.prod_id ?? "").toLowerCase().includes(needle) ||
      (m.mac ?? "").toLowerCase().includes(needle) ||
      String(m.seq) === needle ||
      String(m.used_request_number ?? "") === needle
    );
  });
  const shown = filtered.slice(0, limit);

  const tab = (value: Filter, label: string, count: number): React.ReactNode => (
    <button
      type="button"
      onClick={() => {
        setFilter(value);
        setLimit(PAGE_SIZE);
      }}
      style={{
        padding: "6px 14px",
        cursor: "pointer",
        borderRadius: 6,
        border: "1px solid #ddd",
        background: filter === value ? "#2563eb" : "#fff",
        color: filter === value ? "#fff" : "#111",
      }}
    >
      {label} ({count})
    </button>
  );

  const cards = isAdmin
    ? [
        { label: "الإجمالي", value: counts.total, color: "#111" },
        { label: "المستعمل", value: counts.used, color: "#b45309" },
        { label: "المتبقي", value: counts.remaining, color: "#15803d" },
      ]
    : [{ label: "رصيدك المتبقي", value: counts.remaining, color: "#15803d" }];

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h1>قائمة المودمات</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              style={{ padding: "6px 14px", cursor: "pointer" }}
            >
              + إضافة قائمة مودمات
            </button>
          )}
          <a href="/">← الرجوع للطلبات</a>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.label}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 14,
              textAlign: "center",
            }}
          >
            <div style={{ color: "#666", fontSize: 14 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {isAdmin && owners.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #ddd",
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>تبع</th>
                <th style={th}>الإجمالي</th>
                <th style={th}>المستعمل</th>
                <th style={th}>المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((row) => {
                const key = row.owner ?? SHARED;
                return (
                  <tr
                    key={key}
                    onClick={() => {
                      setOwnerFilter(ownerFilter === key ? "" : key);
                      setLimit(PAGE_SIZE);
                    }}
                    style={{
                      cursor: "pointer",
                      background: ownerFilter === key ? "#eff6ff" : undefined,
                    }}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>
                      {row.owner ?? "الجميع (مشترك)"}
                    </td>
                    <td style={td}>{row.total}</td>
                    <td style={{ ...td, color: "#b45309" }}>{row.used}</td>
                    <td style={{ ...td, color: "#15803d" }}>{row.remaining}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {isAdmin && (
          <>
            {tab("all", "الكل", counts.total)}
            {tab("unused", "غير المستعمل", counts.remaining)}
            {tab("used", "المستعمل", counts.used)}
          </>
        )}
        {isAdmin && ownerFilter && (
          <button
            type="button"
            onClick={() => setOwnerFilter("")}
            style={{ padding: "6px 12px", cursor: "pointer" }}
          >
            إلغاء فلتر الشخص ✕
          </button>
        )}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="بحث بـ SN أو PROD ID أو MAC"
          style={{ padding: 8, fontSize: 15, flex: 1, minWidth: 200 }}
        />
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {loading && <p>جارٍ التحميل...</p>}
      {!loading && modems.length === 0 && !error && (
        <p>
          {isAdmin
            ? "لا توجد مودمات بعد. اضغط «إضافة قائمة مودمات»."
            : "لا توجد مودمات متبقية في رصيدك."}
        </p>
      )}

      {shown.length > 0 && (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>#</th>
                <th style={th}>SN (الكود)</th>
                <th style={th}>PROD ID</th>
                <th style={th}>MAC</th>
                {isAdmin && <th style={th}>تبع</th>}
                {isAdmin && <th style={th}>الحالة</th>}
                {isAdmin && <th style={th}>الطلب</th>}
                {isAdmin && <th style={th}>بواسطة</th>}
                {isAdmin && <th style={th}>التاريخ</th>}
                {isAdmin && <th style={th}>إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => {
                const used = !!m.used_by_request;
                return (
                  <tr key={m.code}>
                    <td style={{ ...td, color: "#666" }}>{m.seq}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{m.code}</td>
                    <td style={td}>{m.prod_id ?? "—"}</td>
                    <td style={td}>{m.mac ?? "—"}</td>
                    {isAdmin && <td style={td}>{m.owner ?? "الجميع"}</td>}
                    {isAdmin && (
                      <td style={td}>
                        <span style={{ color: used ? "#b45309" : "#15803d" }}>
                          {used ? "مستعمل" : "متاح"}
                        </span>
                      </td>
                    )}
                    {isAdmin && (
                      <td style={td}>
                        {used && m.used_request_number
                          ? `#${m.used_request_number}`
                          : "—"}
                      </td>
                    )}
                    {isAdmin && <td style={td}>{m.used_by_user ?? "—"}</td>}
                    {isAdmin && (
                      <td style={td}>
                        {m.used_at ? m.used_at.slice(0, 10) : "—"}
                      </td>
                    )}
                    {isAdmin && (
                      <td style={td}>
                        {!used && (
                          <button
                            type="button"
                            onClick={() => remove(m.code)}
                            style={{ cursor: "pointer", color: "crimson" }}
                          >
                            حذف
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > shown.length && (
        <div style={{ textAlign: "center", margin: 16 }}>
          <button
            type="button"
            onClick={() => setLimit(limit + PAGE_SIZE)}
            style={{ padding: "8px 20px", cursor: "pointer" }}
          >
            عرض المزيد ({filtered.length - shown.length} متبقي)
          </button>
        </div>
      )}

      {importOpen && (
        <ModemImportModal
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </main>
  );
}
