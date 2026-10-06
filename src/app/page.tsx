"use client";

import { useCallback, useEffect, useState } from "react";

type Attachment = { type: string; name: string; url: string | null };
type WifiRequest = {
  id: string;
  request_number: number;
  customer_name: string;
  beneficiary_number: string | null;
  national_id: string | null;
  phone: string | null;
  phone2: string | null;
  code1: string | null;
  code2: string | null;
  moughataa: string | null;
  region: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  attachments: Attachment[];
  created_at: string;
};

type Me = {
  username: string;
  role: "admin" | "user";
  moughataas: string[];
  can_add: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_add_note: boolean;
};

type EditForm = {
  customer_name: string;
  beneficiary_number: string;
  national_id: string;
  phone: string;
  phone2: string;
  code1: string;
  code2: string;
  moughataa: string;
  region: string;
  notes: string;
};

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  review: "قيد المراجعة",
  in_progress: "قيد التنفيذ",
  done: "مكتمل",
  rejected: "مرفوض",
};

const STEPS = ["new", "review", "in_progress", "done"];

const FILE_FIELDS = [
  { field: "id_card", label: "إرفاق بطاقة التعريف" },
  { field: "mauritel_copy", label: "إرفاق صورة من داية موريتل" },
];

const FILE_LABELS: Record<string, string> = {
  id_card: "بطاقة التعريف",
  electricity_bill: "فاتورة الكهرباء",
  mauritel_copy: "داية موريتل",
};

const box: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
};
const input: React.CSSProperties = { padding: 10, fontSize: 16 };
const th: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "right",
  background: "#f3f4f6",
  borderBottom: "1px solid #ddd",
  whiteSpace: "nowrap",
  fontSize: 14,
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  verticalAlign: "middle",
  fontSize: 14,
};

function MiniProgress({ status }: { status: string }) {
  if (status === "rejected") {
    return (
      <div style={{ height: 6, borderRadius: 3, background: "crimson" }} />
    );
  }
  const current = STEPS.indexOf(status);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {STEPS.map((s, i) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background:
              i < current ? "#16a34a" : i === current ? "#2563eb" : "#ddd",
          }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [requests, setRequests] = useState<WifiRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    customer_name: "",
    beneficiary_number: "",
    national_id: "",
    phone: "",
    phone2: "",
    code1: "",
    code2: "",
    moughataa: "",
    region: "",
    notes: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [preview, setPreview] = useState<{
    url: string;
    label: string;
    name: string;
  } | null>(null);

  const [noteId, setNoteId] = useState<string | null>(null);
  const [noteNumber, setNoteNumber] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  const load = useCallback(async () => {
    const [meRes, reqRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/requests"),
    ]);
    if (meRes.status === 401 || reqRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    const meJson = await meRes.json();
    const reqJson = await reqRes.json();
    setMe(meJson.user ?? null);
    setRequests(reqJson.requests ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/requests", {
      method: "POST",
      body: new FormData(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error ?? "حدث خطأ");
      return;
    }
    form.reset();
    setMessage("تم حفظ الطلب");
    load();
  }

  async function changeStatus(id: string, status: string) {
    const res = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? "حدث خطأ");
    }
    load();
  }

  function startEdit(r: WifiRequest) {
    setEditingId(r.id);
    setEditNumber(r.request_number);
    setEditError("");
    setEditForm({
      customer_name: r.customer_name,
      beneficiary_number: r.beneficiary_number ?? "",
      national_id: r.national_id ?? "",
      phone: r.phone ?? "",
      phone2: r.phone2 ?? "",
      code1: r.code1 ?? "",
      code2: r.code2 ?? "",
      moughataa: r.moughataa ?? "",
      region: r.region ?? "",
      notes: r.notes ?? "",
    });
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingId) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/requests/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(json.error ?? "حدث خطأ");
      return;
    }
    setEditingId(null);
    load();
  }

  function startNote(r: WifiRequest) {
    setNoteId(r.id);
    setNoteNumber(r.request_number);
    setNoteText("");
    setNoteError("");
  }

  async function saveNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!noteId) return;
    setNoteSaving(true);
    setNoteError("");
    const res = await fetch(`/api/requests/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add_note: noteText }),
    });
    const json = await res.json();
    setNoteSaving(false);
    if (!res.ok) {
      setNoteError(json.error ?? "حدث خطأ");
      return;
    }
    setNoteId(null);
    load();
  }

  const allowed = me?.moughataas ?? [];

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 1200,
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
        <h1>طلبات الويفي</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {me && (
            <span>
              {me.role === "admin" ? "الأدمن" : me.username}
            </span>
          )}
          {me?.role === "admin" && <a href="/users">إدارة المستخدمين</a>}
          <form method="POST" action="/api/logout">
            <button type="submit" style={{ padding: "4px 12px" }}>
              خروج
            </button>
          </form>
        </div>
      </div>

      {me?.can_add && (
        <form onSubmit={onSubmit} style={{ ...box, display: "grid", gap: 12 }}>
          <h2 style={{ margin: 0 }}>إضافة طلب جديد</h2>
          <input
            name="customer_name"
            placeholder="اسم العميل"
            required
            style={input}
          />
          <input
            name="beneficiary_number"
            placeholder="رقم المستفيد"
            required
            style={input}
          />
          <input name="phone" placeholder="رقم الجوال (اختياري)" style={input} />
          <input name="phone2" placeholder="رقم الجوال الثاني (اختياري)" style={input} />
          <input name="national_id" placeholder="الرقم الوطني (اختياري)" style={input} />
          <input name="code1" placeholder="الكود الأول على داية موريتل (اختياري)" style={input} />
          <input name="code2" placeholder="الكود الثاني (اختياري)" style={input} />
          <select name="moughataa" required defaultValue="" style={input}>
            <option value="" disabled>
              اختر المقاطعة
            </option>
            {allowed.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input name="region" placeholder="المنطقة" style={input} />
          <textarea
            name="notes"
            placeholder="ملاحظات (اختياري)"
            rows={3}
            style={input}
          />

          {FILE_FIELDS.map((f) => (
            <label key={f.field} style={{ display: "grid", gap: 6 }}>
              <strong>{f.label} *</strong>
              <input
                type="file"
                name={f.field}
                required
                accept="image/*,application/pdf"
              />
            </label>
          ))}

          <button type="submit" disabled={saving} style={input}>
            {saving ? "جارٍ الحفظ..." : "حفظ الطلب"}
          </button>
          {message && <p style={{ margin: 0 }}>{message}</p>}
        </form>
      )}

      <h2>الطلبات</h2>
      {loading && <p>جارٍ التحميل...</p>}
      {!loading && requests.length === 0 && <p>لا توجد طلبات بعد.</p>}

      {requests.length > 0 && (
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
                <th style={th}>الرقم</th>
                <th style={th}>الاسم</th>
                <th style={th}>رقم المستفيد</th>
                <th style={th}>الرقم الوطني</th>
                <th style={th}>الجوال</th>
                <th style={th}>الأكواد</th>
                <th style={th}>المرفقات</th>
                <th style={th}>المقاطعة</th>
                <th style={th}>المنطقة</th>
                <th style={th}>الملاحظات</th>
                <th style={th}>الحالة</th>
                {me?.can_edit && <th style={th}>إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    #{r.request_number}
                    {r.source === "whatsapp" && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          fontWeight: 400,
                          color: "#15803d",
                          background: "#dcfce7",
                          borderRadius: 4,
                          padding: "1px 6px",
                          display: "inline-block",
                        }}
                      >
                        واتساب
                      </div>
                    )}
                  </td>
                  <td style={td}>{r.customer_name}</td>
                  <td style={td}>{r.beneficiary_number ?? "—"}</td>
                  <td style={td}>{r.national_id ?? "—"}</td>
                  <td style={td}>
                    <div>{r.phone ?? "—"}</div>
                    {r.phone2 && <div>{r.phone2}</div>}
                  </td>
                  <td style={td}>
                    {r.code1 || r.code2 ? (
                      <>
                        <div>{r.code1 ?? "—"}</div>
                        <div>{r.code2 ?? "—"}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {r.attachments.map((a, i) =>
                        a.url ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              setPreview({
                                url: a.url as string,
                                label: FILE_LABELS[a.type] ?? "مرفق",
                                name: a.name,
                              })
                            }
                            style={{
                              border: "1px solid #ddd",
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            {FILE_LABELS[a.type] ?? "مرفق"}
                          </button>
                        ) : (
                          <span key={i} style={{ fontSize: 12 }}>
                            {FILE_LABELS[a.type] ?? a.name}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td style={td}>{r.moughataa ?? "—"}</td>
                  <td style={td}>{r.region ?? "—"}</td>
                  <td style={{ ...td, maxWidth: 240 }}>
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      {r.notes ?? "—"}
                    </div>
                    {me?.can_add_note && (
                      <button
                        type="button"
                        onClick={() => startNote(r)}
                        style={{ marginTop: 6, padding: "2px 8px", fontSize: 12 }}
                      >
                        + ملاحظة
                      </button>
                    )}
                  </td>
                  <td style={{ ...td, minWidth: 150 }}>
                    <select
                      value={r.status}
                      disabled={!me?.can_change_status}
                      onChange={(e) => changeStatus(r.id, e.target.value)}
                      style={{ padding: 4, width: "100%", marginBottom: 6 }}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <MiniProgress status={r.status} />
                  </td>
                  {me?.can_edit && (
                    <td style={td}>
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        style={{ padding: "4px 12px", cursor: "pointer" }}
                      >
                        تعديل
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 10,
              width: "100%",
              maxWidth: 900,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid #eee",
              }}
            >
              <strong>{preview.label}</strong>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <a href={preview.url} target="_blank" rel="noreferrer">
                  فتح في صفحة جديدة
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  style={{ padding: "4px 12px", cursor: "pointer" }}
                >
                  إغلاق ✕
                </button>
              </div>
            </div>
            <div
              style={{
                flex: 1,
                overflow: "auto",
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 300,
              }}
            >
              {preview.name.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={preview.url}
                  title={preview.label}
                  style={{ width: "100%", height: "78vh", border: 0 }}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.label}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "78vh",
                    objectFit: "contain",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {noteId && (
        <div
          onClick={() => setNoteId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveNote}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              width: "100%",
              maxWidth: 420,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0 }}>إضافة ملاحظة للطلب #{noteNumber}</h2>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="اكتب الملاحظة"
              rows={4}
              required
              style={input}
            />
            {noteError && (
              <p style={{ margin: 0, color: "crimson" }}>{noteError}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={noteSaving}
                style={{ ...input, flex: 1 }}
              >
                {noteSaving ? "جارٍ الحفظ..." : "حفظ الملاحظة"}
              </button>
              <button
                type="button"
                onClick={() => setNoteId(null)}
                style={{ ...input, flex: 1 }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {editingId && (
        <div
          onClick={() => setEditingId(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 10,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveEdit}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              width: "100%",
              maxWidth: 480,
              display: "grid",
              gap: 12,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ margin: 0 }}>تعديل الطلب #{editNumber}</h2>
            <input
              value={editForm.customer_name}
              onChange={(e) =>
                setEditForm({ ...editForm, customer_name: e.target.value })
              }
              placeholder="اسم العميل"
              required
              style={input}
            />
            <input
              value={editForm.beneficiary_number}
              onChange={(e) =>
                setEditForm({ ...editForm, beneficiary_number: e.target.value })
              }
              placeholder="رقم المستفيد"
              style={input}
            />
            <input
              value={editForm.national_id}
              onChange={(e) =>
                setEditForm({ ...editForm, national_id: e.target.value })
              }
              placeholder="الرقم الوطني"
              style={input}
            />
            <input
              value={editForm.phone}
              onChange={(e) =>
                setEditForm({ ...editForm, phone: e.target.value })
              }
              placeholder="رقم الجوال"
              style={input}
            />
            <input
              value={editForm.phone2}
              onChange={(e) =>
                setEditForm({ ...editForm, phone2: e.target.value })
              }
              placeholder="رقم الجوال الثاني"
              style={input}
            />
            <input
              value={editForm.code1}
              onChange={(e) =>
                setEditForm({ ...editForm, code1: e.target.value })
              }
              placeholder="الكود الأول"
              style={input}
            />
            <input
              value={editForm.code2}
              onChange={(e) =>
                setEditForm({ ...editForm, code2: e.target.value })
              }
              placeholder="الكود الثاني"
              style={input}
            />
            <select
              value={editForm.moughataa}
              onChange={(e) =>
                setEditForm({ ...editForm, moughataa: e.target.value })
              }
              style={input}
            >
              <option value="">بدون مقاطعة</option>
              {allowed.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              value={editForm.region}
              onChange={(e) =>
                setEditForm({ ...editForm, region: e.target.value })
              }
              placeholder="المنطقة"
              style={input}
            />
            <textarea
              value={editForm.notes}
              onChange={(e) =>
                setEditForm({ ...editForm, notes: e.target.value })
              }
              placeholder="ملاحظات"
              rows={3}
              style={input}
            />
            {editError && (
              <p style={{ margin: 0, color: "crimson" }}>{editError}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={editSaving}
                style={{ ...input, flex: 1 }}
              >
                {editSaving ? "جارٍ الحفظ..." : "حفظ التعديل"}
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                style={{ ...input, flex: 1 }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
