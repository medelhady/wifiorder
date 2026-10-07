"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseDelimited,
  parseText,
  rowsToTabText,
  templateCsv,
} from "@/lib/modem-import";

// إضافة قائمة مودمات: لصق من إكسل أو رفع ملف (xlsx / csv).
// الأعمدة تُقرأ بأسمائها: PROD ID و SN و MAC.
export default function ModemImportModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  // Whose modems these are: "" = not chosen yet, "__all__" = shared by everyone, otherwise a username.
  const [owner, setOwner] = useState("");
  const [people, setPeople] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((json) =>
        setPeople(
          (json.users ?? [])
            .filter((u: { active: boolean }) => u.active)
            .map((u: { username: string }) => u.username)
        )
      )
      .catch(() => setPeople([]));
  }, []);

  const parsed = useMemo(() => parseText(text), [text]);
  const items = useMemo(() => {
    const seen = new Set<string>();
    return parsed.items.filter((item) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    });
  }, [parsed]);

  function downloadTemplate() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "modems-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setResult("");
    setReading(true);
    try {
      let rows: string[][];

      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = await readSheet(file);
        rows = sheet.map((row) =>
          row.map((cell) =>
            cell === null || cell === undefined ? "" : String(cell).trim()
          )
        );
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        rows = parseDelimited(await file.text(), ",");
      } else {
        setError("نوع الملف غير مدعوم. استخدم ملف إكسل (xlsx) أو csv.");
        return;
      }

      const fromFile = rowsToTabText(rows);
      setText((prev) => (prev.trim() ? prev.replace(/\s+$/, "") + "\n" : "") + fromFile);
    } catch {
      setError("تعذّرت قراءة الملف. تأكد أنه ملف إكسل بصيغة xlsx أو ملف csv.");
    } finally {
      setReading(false);
    }
  }

  async function onAdd() {
    setSaving(true);
    setError("");
    setResult("");
    const res = await fetch("/api/modem-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, owner: owner === "__all__" ? "" : owner }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json.error ?? "حدث خطأ");
      return;
    }
    setText("");
    setResult(
      `تمت إضافة ${json.added} مودم` +
        (json.skipped ? `، وتجاهل ${json.skipped} مكرر موجود مسبقًا` : "")
    );
    onDone();
  }

  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    borderBottom: "1px solid #eee",
    textAlign: "right",
    whiteSpace: "nowrap",
  };

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
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          display: "grid",
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
          <h2 style={{ margin: 0, fontSize: 18 }}>إضافة قائمة مودمات</h2>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "4px 12px", cursor: "pointer" }}
          >
            إغلاق ✕
          </button>
        </div>

        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          الملف يكون في سطره الأول عناوين الأعمدة:{" "}
          <strong dir="ltr">#, PROD ID, SN, MAC</strong>، وتحتها الأكواد. انسخ
          الجدول من إكسل (مع سطر العناوين) والصقه هنا، أو ارفع الملف. تُضاف
          المودمات للقائمة الموجودة وتأخذ أرقامًا تسلسلية بالترتيب، والمكرر
          يُتجاهل. كل مستخدم يشوف مودماته فقط ورصيده المتبقي.
        </p>

        <button
          type="button"
          onClick={downloadTemplate}
          style={{ padding: "6px 12px", cursor: "pointer", justifySelf: "start" }}
        >
          ⬇ تحميل نموذج الملف (CSV)
        </button>

        <label style={{ display: "grid", gap: 4 }}>
          <strong>تبع مين هذه المودمات؟</strong>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{ padding: 10, fontSize: 16 }}
          >
            <option value="" disabled>
              اختر...
            </option>
            <option value="__all__">الجميع (مشتركة)</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder="الصق الجدول هنا"
          dir="ltr"
          style={{ padding: 10, fontSize: 14, fontFamily: "monospace" }}
        />

        <label style={{ display: "grid", gap: 4 }}>
          <span>أو ارفع ملف إكسل (xlsx) أو csv:</span>
          <input
            type="file"
            accept=".xlsx,.csv,.txt"
            onChange={onFile}
            disabled={reading}
          />
        </label>
        {reading && <p style={{ margin: 0 }}>جارٍ قراءة الملف...</p>}

        {items.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: "#444", fontSize: 14 }}>
              سيتم إضافة <strong>{items.length}</strong> مودم
              {parsed.items.length > items.length
                ? ` (${parsed.items.length - items.length} مكرر داخل القائمة)`
                : ""}
              {!parsed.hasHeader && " — لم أجد سطر عناوين، اعتبرت أول عمود هو الكود."}
            </div>
            <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 6 }}>
              <table dir="ltr" style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={cellStyle}>SN</th>
                    <th style={cellStyle}>PROD ID</th>
                    <th style={cellStyle}>MAC</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 5).map((item) => (
                    <tr key={item.code}>
                      <td style={cellStyle}>{item.sn || item.code}</td>
                      <td style={cellStyle}>{item.prod_id || "—"}</td>
                      <td style={cellStyle}>{item.mac || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {items.length > 5 && (
              <div style={{ color: "#666", fontSize: 12 }}>
                يظهر أول 5 فقط للمعاينة.
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "#444", fontSize: 14 }}>لا توجد أكواد بعد.</div>
        )}

        {error && <p style={{ margin: 0, color: "crimson" }}>{error}</p>}
        {result && <p style={{ margin: 0, color: "#15803d" }}>{result}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onAdd}
            disabled={saving || items.length === 0 || !owner}
            style={{ padding: 10, fontSize: 16, flex: 1 }}
          >
            {saving ? "جارٍ الإضافة..." : "إضافة المودمات"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: 10, fontSize: 16, flex: 1 }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
