"use client";

import { useCallback, useEffect, useState } from "react";

const box: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const input: React.CSSProperties = { padding: 10, fontSize: 16 };

export default function ModemCodesPage() {
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/modem-codes");
    const json = await res.json();
    setCodes(json.codes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? "");
      setText((prev) => (prev ? prev + "\n" : "") + content);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/modem-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codes: text }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error ?? "حدث خطأ");
      return;
    }
    setText("");
    setMessage(`تمت المعالجة (${json.received} كود). المكرر يُتجاهل.`);
    load();
  }

  async function remove(code: string) {
    if (!confirm(`حذف الكود ${code} من القائمة؟`)) return;
    await fetch("/api/modem-codes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    load();
  }

  const shown = filter
    ? codes.filter((c) => c.toLowerCase().includes(filter.toLowerCase()))
    : codes;

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 800,
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
        }}
      >
        <h1>أكواد المودم</h1>
        <a href="/">← الرجوع للطلبات</a>
      </div>

      <form onSubmit={onAdd} style={{ ...box, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>تحميل الأكواد</h2>
        <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
          الصق الأكواد هنا (كود في كل سطر، أو افصل بينها بفاصلة)، أو ارفع ملف
          نصي (txt أو csv). الأكواد الموجودة مسبقًا لا تتكرر.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"كود1\nكود2\nكود3"}
          style={{ ...input, fontFamily: "monospace" }}
        />
        <input type="file" accept=".txt,.csv,text/plain" onChange={onFile} />
        <button type="submit" disabled={saving || !text.trim()} style={input}>
          {saving ? "جارٍ الحفظ..." : "إضافة الأكواد"}
        </button>
        {message && <p style={{ margin: 0 }}>{message}</p>}
      </form>

      <h2>
        القائمة الحالية ({codes.length})
      </h2>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="بحث في الأكواد"
        style={{ ...input, width: "100%", boxSizing: "border-box", marginBottom: 12 }}
      />
      {loading && <p>جارٍ التحميل...</p>}
      {!loading && codes.length === 0 && <p>لا توجد أكواد بعد.</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {shown.slice(0, 500).map((code) => (
          <span
            key={code}
            style={{
              border: "1px solid #ddd",
              borderRadius: 6,
              padding: "4px 8px",
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              background: "#fff",
            }}
          >
            {code}
            <button
              type="button"
              onClick={() => remove(code)}
              style={{ cursor: "pointer", border: 0, background: "transparent", color: "crimson" }}
              aria-label={`حذف ${code}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      {shown.length > 500 && (
        <p style={{ color: "#666" }}>
          يظهر أول 500 كود فقط. استخدم البحث للوصول لبقية الأكواد.
        </p>
      )}
    </main>
  );
}
