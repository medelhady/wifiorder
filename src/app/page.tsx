"use client";

import { useCallback, useEffect, useState } from "react";
import ModemPicker, { type Modem } from "@/components/ModemPicker";
import ModemImportModal from "@/components/ModemImportModal";

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
  modem_code: string | null;
  region: string | null;
  notes: string | null;
  status: string;
  source: string | null;
  assigned_to: string | null;
  attachments: Attachment[];
  created_at: string;
};

type Me = {
  username: string;
  role: "admin" | "user";
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

  const [modems, setModems] = useState<Modem[]>([]);
  const [stock, setStock] = useState<{
    remaining: number;
    total?: number;
    used?: number;
  }>({ remaining: 0 });
  const [importOpen, setImportOpen] = useState(false);
  const [newModem, setNewModem] = useState("");

  // Admin only: who the requests can be handed to, which rows are ticked, and the assign popup.
  const [people, setPeople] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [assignIds, setAssignIds] = useState<string[] | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  // Which request the modem picker is open for ("new" = the add form).
  const [pickFor, setPickFor] = useState<
    "new" | { id: string; number: number; current: string | null } | null
  >(null);

  const load = useCallback(async () => {
    const [meRes, reqRes, modemRes] = await Promise.all([
      fetch("/api/me"),
      fetch("/api/requests"),
      fetch("/api/modem-codes"),
    ]);
    if (meRes.status === 401 || reqRes.status === 401) {
      window.location.href = "/login";
      return;
    }
    const meJson = await meRes.json();
    const reqJson = await reqRes.json();
    const modemJson = await modemRes.json();
    setMe(meJson.user ?? null);
    setRequests(reqJson.requests ?? []);
    if (meJson.user?.role === "admin") {
      const peopleRes = await fetch("/api/users");
      if (peopleRes.ok) {
        const peopleJson = await peopleRes.json();
        setPeople(
          (peopleJson.users ?? [])
            .filter((u: { active: boolean }) => u.active)
            .map((u: { username: string }) => u.username)
        );
      }
    }
    setModems(modemJson.modems ?? []);
    setStock({
      remaining: modemJson.remaining ?? 0,
      total: modemJson.total,
      used: modemJson.used,
    });
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
    const formData = new FormData(form);
    if (newModem) formData.append("modem_code", newModem);
    const res = await fetch("/api/requests", {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error ?? "حدث خطأ");
      return;
    }
    form.reset();
    setNewModem("");
    setMessage(json.warning ? `تم حفظ الطلب${json.warning}` : "تم حفظ الطلب");
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

  async function assignModem(requestId: string, code: string) {
    const res = await fetch(`/api/requests/${requestId}/modem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? "حدث خطأ");
    }
    setPickFor(null);
    load();
  }

  async function runBulk(action: "assign" | "delete", ids: string[], username?: string) {
    setBulkBusy(true);
    const res = await fetch("/api/requests/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids, username }),
    });
    const json = await res.json();
    setBulkBusy(false);
    if (!res.ok) {
      alert(json.error ?? "حدث خطأ");
      return;
    }
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    setAssignIds(null);
    load();
  }

  function askDelete(ids: string[]) {
    const text =
      ids.length === 1
        ? "حذف هذا الطلب نهائيًا مع مرفقاته؟ المودم المرتبط به يرجع للرصيد."
        : `حذف ${ids.length} طلب نهائيًا مع مرفقاتها؟ المودمات المرتبطة بها ترجع للرصيد.`;
    if (confirm(text)) runBulk("delete", ids);
  }

  function toggleOne(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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


  const visibleRequests =
    me?.role === "admin" && assigneeFilter
      ? requests.filter((r) =>
          assigneeFilter === "__none__"
            ? !r.assigned_to
            : r.assigned_to === assigneeFilter
        )
      : requests;

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
          <span
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 14,
            }}
          >
            {me?.role === "admin" && stock.total !== undefined
              ? `المودمات: الإجمالي ${stock.total} — المتبقي ${stock.remaining}`
              : `المودمات المتبقية: ${stock.remaining}`}
          </span>
          {me?.role === "admin" && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              style={{ padding: "4px 12px", cursor: "pointer" }}
            >
              + إضافة قائمة مودمات
            </button>
          )}
          <a href="/modem-codes">قائمة المودمات</a>
          {me?.role === "admin" && <a href="/users">إدارة المستخدمين</a>}
          <form method="POST" action="/api/logout">
            <button type="submit" style={{ padding: "4px 12px" }}>
              خروج
            </button>
          </form>
        </div>
      </div>

      {me?.role === "admin" && (
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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setPickFor("new")}
              style={{ ...input, flex: 1, textAlign: "right", cursor: "pointer" }}
            >
              {newModem ? `المودم: ${newModem}` : "اختيار كود المودم (اختياري)"}
            </button>
            {newModem && (
              <button
                type="button"
                onClick={() => setNewModem("")}
                style={{ padding: 10, cursor: "pointer" }}
              >
                إزالة
              </button>
            )}
          </div>
          <input name="region" placeholder="المنطقة" style={input} />
          <select name="assigned_to" defaultValue="" style={input}>
            <option value="">إسناد الطلب إلى... (اختياري)</option>
            {people.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
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

      {me?.role === "admin" && requests.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            style={{ padding: 6 }}
          >
            <option value="">عرض: كل الطلبات</option>
            <option value="__none__">غير المسندة</option>
            {people.map((name) => (
              <option key={name} value={name}>
                المسندة إلى {name}
              </option>
            ))}
          </select>

          {selected.length > 0 && (
            <>
              <strong>المحدد: {selected.length}</strong>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => {
                  setAssignTo("");
                  setAssignIds(selected);
                }}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                إسناد المحدد
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => askDelete(selected)}
                style={{ padding: "6px 12px", cursor: "pointer", color: "crimson" }}
              >
                حذف المحدد
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                style={{ padding: "6px 12px", cursor: "pointer" }}
              >
                إلغاء التحديد
              </button>
            </>
          )}
        </div>
      )}

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
                <th style={th}>
                  {me?.role === "admin" && (
                    <input
                      type="checkbox"
                      aria-label="تحديد الكل"
                      checked={
                        visibleRequests.length > 0 &&
                        visibleRequests.every((r) => selected.includes(r.id))
                      }
                      onChange={(e) =>
                        setSelected(e.target.checked ? visibleRequests.map((r) => r.id) : [])
                      }
                      style={{ marginInlineEnd: 6 }}
                    />
                  )}
                  الرقم
                </th>
                <th style={th}>الاسم</th>
                <th style={th}>رقم المستفيد</th>
                <th style={th}>الرقم الوطني</th>
                <th style={th}>الجوال</th>
                <th style={th}>الأكواد</th>
                <th style={th}>المرفقات</th>
                <th style={th}>كود المودم</th>
                <th style={th}>المنطقة</th>
                <th style={th}>الملاحظات</th>
                {me?.role === "admin" && <th style={th}>مسند إلى</th>}
                <th style={th}>الحالة</th>
                {me?.can_edit && <th style={th}>إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {me?.role === "admin" && (
                        <input
                          type="checkbox"
                          checked={selected.includes(r.id)}
                          onChange={() => toggleOne(r.id)}
                        />
                      )}
                      <span>#{r.request_number}</span>
                    </div>
                    {me?.role === "admin" && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAssignTo(r.assigned_to ?? "");
                            setAssignIds([r.id]);
                          }}
                          style={{ padding: "1px 8px", fontSize: 12, cursor: "pointer" }}
                        >
                          إسناد
                        </button>
                        <button
                          type="button"
                          onClick={() => askDelete([r.id])}
                          style={{
                            padding: "1px 8px",
                            fontSize: 12,
                            cursor: "pointer",
                            color: "crimson",
                          }}
                        >
                          حذف
                        </button>
                      </div>
                    )}
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
                  <td style={td}>
                    <div>{r.modem_code ?? "—"}</div>
                    {me?.can_edit && (
                      <button
                        type="button"
                        onClick={() =>
                          setPickFor({
                            id: r.id,
                            number: r.request_number,
                            current: r.modem_code,
                          })
                        }
                        style={{ marginTop: 4, padding: "2px 8px", fontSize: 12 }}
                      >
                        {r.modem_code ? "تغيير" : "اختيار"}
                      </button>
                    )}
                  </td>
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
                  {me?.role === "admin" && (
                    <td style={td}>
                      {r.assigned_to ?? (
                        <span style={{ color: "#b45309" }}>غير مسند</span>
                      )}
                    </td>
                  )}
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

      {assignIds && (
        <div
          onClick={() => setAssignIds(null)}
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
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              width: "100%",
              maxWidth: 380,
              display: "grid",
              gap: 12,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>
              إسناد {assignIds.length === 1 ? "الطلب" : `${assignIds.length} طلب`} إلى مستخدم
            </h2>
            <select
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
              style={input}
            >
              <option value="">بدون إسناد (يراه الأدمن فقط)</option>
              {people.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p style={{ margin: 0, color: "#666", fontSize: 13 }}>
              المستخدم لا يرى إلا الطلبات المسندة إليه.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => runBulk("assign", assignIds, assignTo)}
                style={{ ...input, flex: 1 }}
              >
                {bulkBusy ? "جارٍ الإسناد..." : "إسناد"}
              </button>
              <button
                type="button"
                onClick={() => setAssignIds(null)}
                style={{ ...input, flex: 1 }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <ModemImportModal
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}

      {pickFor && (
        <ModemPicker
          showOwner={me?.role === "admin"}
          modems={modems}
          current={pickFor === "new" ? newModem || null : pickFor.current}
          title={
            pickFor === "new"
              ? "اختيار مودم للطلب الجديد"
              : `اختيار مودم للطلب #${pickFor.number}`
          }
          onPick={(code) => {
            if (pickFor === "new") {
              setNewModem(code);
              setPickFor(null);
            } else {
              assignModem(pickFor.id, code);
            }
          }}
          onClear={() => {
            if (pickFor === "new") {
              setNewModem("");
              setPickFor(null);
            } else {
              assignModem(pickFor.id, "");
            }
          }}
          onClose={() => setPickFor(null)}
        />
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
