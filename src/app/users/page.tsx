"use client";

import { useCallback, useEffect, useState } from "react";

type AppUser = {
  id: string;
  username: string;
  modem_codes: string[];
  can_add: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_add_note: boolean;
  active: boolean;
  created_at: string;
};

type FormState = {
  username: string;
  password: string;
  modem_codes: string[];
  can_add: boolean;
  can_edit: boolean;
  can_change_status: boolean;
  can_add_note: boolean;
};

const emptyForm: FormState = {
  username: "",
  password: "",
  modem_codes: [],
  can_add: true,
  can_edit: true,
  can_change_status: true,
  can_add_note: true,
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

function toggleItem(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Fields({
  form,
  setForm,
  isEdit,
  codes,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  isEdit: boolean;
  codes: string[];
}) {
  return (
    <>
      {!isEdit && (
        <input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="اسم المستخدم (حروف إنجليزية صغيرة وأرقام)"
          required
          style={input}
        />
      )}
      <input
        type="text"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        placeholder={
          isEdit
            ? "كلمة سر جديدة (اتركها فارغة بدون تغيير)"
            : "كلمة السر (6 أحرف على الأقل)"
        }
        required={!isEdit}
        style={input}
      />

      <div>
        <strong>أكواد المودم المسموحة</strong>
        <div style={{ color: "#666", fontSize: 13, margin: "4px 0 8px" }}>
          اتركها كلها بدون تحديد لإعطاء صلاحية على كل الأكواد.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {codes.length === 0 && (
            <span style={{ color: "#666", fontSize: 13 }}>
              لا توجد أكواد بعد. أضفها من صفحة أكواد المودم.
            </span>
          )}
          {codes.map((m) => (
            <label key={m} style={{ display: "flex", gap: 4 }}>
              <input
                type="checkbox"
                checked={form.modem_codes.includes(m)}
                onChange={() =>
                  setForm({
                    ...form,
                    modem_codes: toggleItem(form.modem_codes, m),
                  })
                }
              />
              {m}
            </label>
          ))}
        </div>
      </div>

      <div>
        <strong>الصلاحيات</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
          <label style={{ display: "flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={form.can_add}
              onChange={(e) => setForm({ ...form, can_add: e.target.checked })}
            />
            إضافة طلبات
          </label>
          <label style={{ display: "flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={form.can_edit}
              onChange={(e) => setForm({ ...form, can_edit: e.target.checked })}
            />
            تعديل المعلومات
          </label>
          <label style={{ display: "flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={form.can_change_status}
              onChange={(e) =>
                setForm({ ...form, can_change_status: e.target.checked })
              }
            />
            تغيير الحالة
          </label>
          <label style={{ display: "flex", gap: 4 }}>
            <input
              type="checkbox"
              checked={form.can_add_note}
              onChange={(e) =>
                setForm({ ...form, can_add_note: e.target.checked })
              }
            />
            إضافة ملاحظة
          </label>
        </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [codes, setCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [res, codesRes] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/modem-codes"),
    ]);
    const json = await res.json();
    const codesJson = await codesRes.json();
    setUsers(json.users ?? []);
    setCodes(codesJson.codes ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error ?? "حدث خطأ");
      return;
    }
    setForm(emptyForm);
    setMessage("تمت إضافة المستخدم");
    load();
  }

  function startEdit(u: AppUser) {
    setEditing(u);
    setEditError("");
    setEditForm({
      username: u.username,
      password: "",
      modem_codes: u.modem_codes ?? [],
      can_add: u.can_add,
      can_edit: u.can_edit,
      can_change_status: u.can_change_status,
      can_add_note: u.can_add_note,
    });
  }

  async function onSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setEditError("");
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modem_codes: editForm.modem_codes,
        can_add: editForm.can_add,
        can_edit: editForm.can_edit,
        can_change_status: editForm.can_change_status,
        can_add_note: editForm.can_add_note,
        password: editForm.password || undefined,
      }),
    });
    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(json.error ?? "حدث خطأ");
      return;
    }
    setEditing(null);
    load();
  }

  async function setActive(u: AppUser, active: boolean) {
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    load();
  }

  async function remove(u: AppUser) {
    if (!confirm(`حذف المستخدم ${u.username}؟`)) return;
    await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    load();
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 1000,
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
        <h1>إدارة المستخدمين</h1>
        <a href="/">← الرجوع للطلبات</a>
      </div>

      <form onSubmit={onCreate} style={{ ...box, display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0 }}>إضافة مستخدم</h2>
        <Fields form={form} setForm={setForm} isEdit={false} codes={codes} />
        <button type="submit" disabled={saving} style={input}>
          {saving ? "جارٍ الحفظ..." : "إضافة المستخدم"}
        </button>
        {message && <p style={{ margin: 0 }}>{message}</p>}
      </form>

      <h2>المستخدمون</h2>
      {loading && <p>جارٍ التحميل...</p>}
      {!loading && users.length === 0 && <p>لا يوجد مستخدمون بعد.</p>}

      {users.length > 0 && (
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
                <th style={th}>المستخدم</th>
                <th style={th}>أكواد المودم</th>
                <th style={th}>الصلاحيات</th>
                <th style={th}>الحالة</th>
                <th style={th}>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ ...td, fontWeight: 700 }}>{u.username}</td>
                  <td style={td}>
                    {u.modem_codes && u.modem_codes.length > 0
                      ? u.modem_codes.join("، ")
                      : "الكل"}
                  </td>
                  <td style={td}>
                    {[
                      u.can_add && "إضافة",
                      u.can_edit && "تعديل",
                      u.can_change_status && "تغيير الحالة",
                      u.can_add_note && "إضافة ملاحظة",
                    ]
                      .filter(Boolean)
                      .join("، ") || "عرض فقط"}
                  </td>
                  <td style={td}>
                    <span style={{ color: u.active ? "#16a34a" : "crimson" }}>
                      {u.active ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => startEdit(u)}>
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => setActive(u, !u.active)}
                      >
                        {u.active ? "إيقاف" : "تفعيل"}
                      </button>
                      <button type="button" onClick={() => remove(u)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div
          onClick={() => setEditing(null)}
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
            onSubmit={onSaveEdit}
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              width: "100%",
              maxWidth: 520,
              display: "grid",
              gap: 12,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ margin: 0 }}>تعديل المستخدم: {editing.username}</h2>
            <Fields form={editForm} setForm={setEditForm} isEdit={true} codes={codes} />
            {editError && (
              <p style={{ margin: 0, color: "crimson" }}>{editError}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                disabled={editSaving}
                style={{ ...input, flex: 1 }}
              >
                {editSaving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
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
