"use client";

import { useCallback, useEffect, useState } from "react";
import ModemPicker, { type Modem } from "@/components/ModemPicker";
import ModemImportModal from "@/components/ModemImportModal";
import ImageZoom from "@/components/ImageZoom";

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
  account_created: "تم إنشاء الحساب",
  paid: "تم الدفع",
  done: "مكتمل",
  rejected: "مرفوض",
};

const STEPS = ["new", "account_created", "paid", "done"];

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


// A beneficiary number that looks like a phone number opens a WhatsApp chat: eight digits are a
// Mauritanian number (222 is added), nine to fifteen digits are taken as already international.
function whatsappLink(value: string | null | undefined): string | null {
  let digits = (value ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 8) digits = "222" + digits;

  return digits.length >= 9 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

const css = `
.wf { --bd:#e5e7eb; --muted:#6b7280; --blue:#2563eb; max-width:1280px; margin:0 auto; padding:16px; font-family:system-ui,"Segoe UI",Tahoma,sans-serif; color:#111827; }
.wf *, .wf *::before, .wf *::after { box-sizing:border-box; }
.wf button, .wf select, .wf input, .wf textarea { font-family:inherit; }
.wf .ltr { direction:ltr; unicode-bidi:isolate; display:inline-block; }
.wf .topbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:14px 18px; background:#fff; border:1px solid var(--bd); border-radius:12px; margin-bottom:14px; }
.wf .brand h1 { margin:0; font-size:22px; line-height:1.2; }
.wf .brand small { color:var(--muted); }
.wf .actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.wf .btn { padding:7px 14px; border:1px solid var(--bd); border-radius:8px; background:#fff; cursor:pointer; font-size:14px; text-decoration:none; color:#111827; display:inline-flex; align-items:center; gap:6px; line-height:1.3; }
.wf .btn:hover { background:#f3f4f6; }
.wf .btn:disabled { opacity:.55; cursor:default; }
.wf .btn.primary { background:var(--blue); border-color:var(--blue); color:#fff; }
.wf .btn.primary:hover { background:#1d4ed8; }
.wf .btn.danger { color:#b91c1c; border-color:#fecaca; }
.wf .btn.danger:hover { background:#fef2f2; }
.wf .btn.whatsapp { background:#dcfce7; border-color:#86efac; color:#166534; }
.wf .btn.whatsapp:hover { background:#bbf7d0; }
.wf .btn.sm { padding:3px 10px; font-size:12px; border-radius:6px; }
.wf .pill { background:#eff6ff; border:1px solid #bfdbfe; border-radius:999px; padding:6px 14px; font-size:14px; white-space:nowrap; }
.wf .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(125px,1fr)); gap:10px; margin-bottom:14px; }
.wf .stat { text-align:right; padding:10px 14px; border:1px solid var(--bd); border-radius:10px; background:#fff; cursor:pointer; }
.wf .stat b { display:block; font-size:22px; line-height:1.2; }
.wf .stat span { font-size:13px; color:var(--muted); }
.wf .stat:hover { background:#f9fafb; }
.wf .stat.active { border-color:var(--blue); background:#eff6ff; box-shadow:0 0 0 1px var(--blue) inset; }
.wf .toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:12px; }
.wf .toolbar input[type=search] { flex:1; min-width:220px; padding:9px 12px; border:1px solid var(--bd); border-radius:8px; font-size:15px; }
.wf .toolbar select { padding:9px 10px; border:1px solid var(--bd); border-radius:8px; background:#fff; font-size:14px; }
.wf .checkall { display:inline-flex; gap:6px; align-items:center; font-size:14px; color:var(--muted); }
.wf .selbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; margin-bottom:12px; }
.wf .panel { background:#fff; border:1px solid var(--bd); border-radius:12px; padding:16px; margin-bottom:14px; }
.wf .panel h2 { margin:0 0 12px; font-size:17px; }
.wf .formgrid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:12px; }
.wf .formgrid input:not([type=file]), .wf .formgrid select, .wf .formgrid textarea { padding:10px; font-size:15px; border:1px solid var(--bd); border-radius:8px; width:100%; background:#fff; }
.wf .formgrid .full { grid-column:1 / -1; }
.wf .formgrid label { display:grid; gap:6px; font-size:14px; }
.wf .card { background:#fff; border:1px solid var(--bd); border-radius:12px; margin-bottom:10px; overflow:hidden; }
.wf .card.sel { border-color:var(--blue); box-shadow:0 0 0 2px #bfdbfe; }
.wf .card-main { display:grid; grid-template-columns:110px 1.4fr 1fr 1.3fr 1.1fr 1.3fr; gap:14px; padding:14px 16px; align-items:start; }
.wf .cap { font-size:11px; color:var(--muted); margin-bottom:3px; }
.wf .val { font-size:15px; word-break:break-word; }
.wf .val.strong { font-weight:700; font-size:16px; }
.wf .sub { font-size:13px; color:var(--muted); margin-top:2px; }
.wf .num { display:flex; align-items:center; gap:8px; font-size:20px; font-weight:800; }
.wf .wa-link { color:#15803d; font-weight:600; text-decoration:none; border-bottom:1px dashed #15803d; border-radius:3px; padding:0 2px; }
.wf .wa-link:hover { background:#dcfce7; }
.wf .badge { display:inline-block; margin-top:6px; font-size:11px; color:#15803d; background:#dcfce7; border-radius:999px; padding:1px 8px; }
.wf .card-foot { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; padding:8px 16px; background:#f9fafb; border-top:1px solid var(--bd); }
.wf .foot-actions { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.wf .chips { display:flex; flex-wrap:wrap; gap:6px; }
.wf .chip { padding:4px 12px; font-size:12px; border:1px solid var(--bd); border-radius:999px; background:#fff; cursor:pointer; }
.wf .chip:hover { background:#eff6ff; border-color:#bfdbfe; }
.wf .note { white-space:pre-wrap; font-size:14px; padding:10px 16px; border-top:1px dashed var(--bd); background:#fffbeb; }
.wf .status select { width:100%; padding:7px 8px; border:1px solid var(--bd); border-radius:8px; background:#fff; margin-bottom:8px; font-size:14px; }
.wf .empty { text-align:center; color:var(--muted); padding:36px 12px; background:#fff; border:1px dashed var(--bd); border-radius:12px; }
@media (max-width:1050px) { .wf .card-main { grid-template-columns:1fr 1fr 1fr; } }
@media (max-width:640px) { .wf { padding:10px; } .wf .card-main { grid-template-columns:1fr 1fr; } .wf .topbar { padding:12px; } }
@media (max-width:340px) { .wf .card-main { grid-template-columns:1fr; } }
`;

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
  const [toast, setToast] = useState("");
  // The add-request form is folded away until it is needed.
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
    const done = json.warning ? `تم حفظ الطلب${json.warning}` : "تم حفظ الطلب";
    setMessage(done);
    setAddOpen(false);
    showToast(done);
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

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(""), 4500);
  }

  // The short form that is copied or sent: only the values, one line each, in this order --
  // name, national ID, phone numbers, the two codes on the Mauritel device. Nothing that is empty.
  function buildSummary(r: WifiRequest) {
    const clean = (value: string | null | undefined) => (value ?? "").trim();
    const together = (...values: (string | null | undefined)[]) =>
      values.map(clean).filter(Boolean).join(" - ");

    return [
      clean(r.customer_name),
      clean(r.national_id),
      together(r.phone, r.phone2),
      together(r.code1, r.code2),
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function copySummary(r: WifiRequest) {
    try {
      await navigator.clipboard.writeText(buildSummary(r));
      showToast("تم نسخ الملخص ✓");
    } catch {
      showToast("تعذّر النسخ. اسمح للموقع بالوصول للحافظة.");
    }
  }

  // On a phone the summary and the pictures go to WhatsApp together. A computer cannot attach files
  // to a WhatsApp link, so there only the summary opens in WhatsApp.
  async function shareToWhatsApp(r: WifiRequest) {
    const text = buildSummary(r);
    const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

    try {
      showToast("جارٍ تجهيز المرفقات...");
      const files: File[] = [];
      const names: Record<string, string> = { id_card: "id-card", mauritel_copy: "mauritel" };

      for (const [index, a] of r.attachments.entries()) {
        if (!a.url) continue;
        const res = await fetch(a.url);
        const blob = await res.blob();
        const ext = blob.type.includes("pdf") ? "pdf" : blob.type.split("/")[1] || "jpg";
        files.push(
          new File([blob], `${names[a.type] ?? `file-${index + 1}`}.${ext}`, { type: blob.type })
        );
      }

      if (files.length > 0 && nav.canShare?.({ files })) {
        await navigator.share({ text, files });
        setToast("");
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setToast("");
        return;
      }
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    showToast("فتحت واتساب بالملخص. من الكمبيوتر المرفقات تُرسل من الطلب نفسه، ومن الجوال تُرسل مع الملخص.");
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

  const needle = search.trim().toLowerCase();
  const shownRequests = visibleRequests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (!needle) return true;
    return [
      r.customer_name,
      r.national_id,
      r.phone,
      r.phone2,
      r.beneficiary_number,
      r.code1,
      r.code2,
      r.modem_code,
      r.region,
      String(r.request_number),
      r.assigned_to,
    ].some((value) => (value ?? "").toLowerCase().includes(needle));
  });
  const countOf = (status: string) => visibleRequests.filter((r) => r.status === status).length;
  const isAdmin = me?.role === "admin";

  return (
    <main dir="rtl" className="wf">
      <style>{css}</style>

      <div className="topbar">
        <div className="brand">
          <h1>طلبات الويفي</h1>
          {me && (
            <small>{isAdmin ? "الأدمن" : `مرحبًا ${me.username}`}</small>
          )}
        </div>
        <div className="actions">
          <span className="pill">
            {isAdmin && stock.total !== undefined
              ? `المودمات: ${stock.total} إجمالي · ${stock.remaining} متبقي`
              : `المودمات المتبقية: ${stock.remaining}`}
          </span>
          {isAdmin && (
            <button type="button" className="btn" onClick={() => setImportOpen(true)}>
              + إضافة قائمة مودمات
            </button>
          )}
          <a className="btn" href="/modem-codes">
            قائمة المودمات
          </a>
          {isAdmin && (
            <a className="btn" href="/users">
              المستخدمون
            </a>
          )}
          <form method="POST" action="/api/logout" style={{ display: "inline" }}>
            <button type="submit" className="btn">
              خروج
            </button>
          </form>
        </div>
      </div>

      <div className="stats">
        <button
          type="button"
          className={`stat${statusFilter === "" ? " active" : ""}`}
          onClick={() => setStatusFilter("")}
        >
          <b>{visibleRequests.length}</b>
          <span>كل الطلبات</span>
        </button>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`stat${statusFilter === value ? " active" : ""}`}
            onClick={() => setStatusFilter(statusFilter === value ? "" : value)}
          >
            <b>{countOf(value)}</b>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الرقم الوطني أو الهاتف أو الكود أو رقم الطلب..."
        />
        {isAdmin && (
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
          >
            <option value="">كل المستخدمين</option>
            <option value="__none__">غير المسندة</option>
            {people.map((name) => (
              <option key={name} value={name}>
                المسندة إلى {name}
              </option>
            ))}
          </select>
        )}
        {isAdmin && (
          <label className="checkall">
            <input
              type="checkbox"
              checked={
                shownRequests.length > 0 &&
                shownRequests.every((r) => selected.includes(r.id))
              }
              onChange={(e) =>
                setSelected(e.target.checked ? shownRequests.map((r) => r.id) : [])
              }
            />
            تحديد الكل ({shownRequests.length})
          </label>
        )}
        {isAdmin && (
          <button
            type="button"
            className="btn primary"
            aria-expanded={addOpen}
            onClick={() => setAddOpen((open) => !open)}
          >
            {addOpen ? "إغلاق النموذج ▴" : "+ طلب جديد"}
          </button>
        )}
      </div>

      {isAdmin && (
        <form
          onSubmit={onSubmit}
          className="panel"
          style={{ display: addOpen ? "block" : "none" }}
        >
          <h2>إضافة طلب جديد</h2>
          <div className="formgrid">
            <input name="customer_name" placeholder="اسم العميل" required />
            <input name="beneficiary_number" placeholder="رقم المستفيد" required />
            <input name="national_id" placeholder="الرقم الوطني (اختياري)" />
            <input name="phone" placeholder="رقم الجوال (اختياري)" />
            <input name="phone2" placeholder="رقم الجوال الثاني (اختياري)" />
            <input name="region" placeholder="المنطقة" />
            <input name="code1" placeholder="الكود العلوي (اختياري)" />
            <input name="code2" placeholder="الكود السفلي (اختياري)" />
            <select name="assigned_to" defaultValue="">
              <option value="">إسناد الطلب إلى... (اختياري)</option>
              {people.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setPickFor("new")}
                style={{ flex: 1, justifyContent: "flex-start", padding: 10 }}
              >
                {newModem ? (
                  <>
                    المودم: <span className="ltr">{newModem}</span>
                  </>
                ) : (
                  "اختيار كود المودم (اختياري)"
                )}
              </button>
              {newModem && (
                <button type="button" className="btn" onClick={() => setNewModem("")}>
                  إزالة
                </button>
              )}
            </div>
            <textarea name="notes" placeholder="ملاحظات (اختياري)" rows={3} className="full" />
            {FILE_FIELDS.map((f) => (
              <label key={f.field}>
                <strong>{f.label} *</strong>
                <input type="file" name={f.field} required accept="image/*,application/pdf" />
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <button type="submit" disabled={saving} className="btn primary" style={{ padding: "10px 24px" }}>
              {saving ? "جارٍ الحفظ..." : "حفظ الطلب"}
            </button>
            {message && <span style={{ color: "var(--muted)" }}>{message}</span>}
          </div>
        </form>
      )}

      {isAdmin && selected.length > 0 && (
        <div className="selbar">
          <strong>المحدد: {selected.length}</strong>
          <button
            type="button"
            className="btn"
            disabled={bulkBusy}
            onClick={() => {
              setAssignTo("");
              setAssignIds(selected);
            }}
          >
            إسناد المحدد
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={bulkBusy}
            onClick={() => askDelete(selected)}
          >
            حذف المحدد
          </button>
          <button type="button" className="btn" onClick={() => setSelected([])}>
            إلغاء التحديد
          </button>
        </div>
      )}

      {loading && <div className="empty">جارٍ التحميل...</div>}
      {!loading && requests.length === 0 && (
        <div className="empty">لا توجد طلبات بعد.</div>
      )}
      {!loading && requests.length > 0 && shownRequests.length === 0 && (
        <div className="empty">لا توجد طلبات تطابق البحث أو الفلتر.</div>
      )}

      {shownRequests.map((r) => (
        <div key={r.id} className={`card${selected.includes(r.id) ? " sel" : ""}`}>
          <div className="card-main">
            <div>
              <div className="num">
                {isAdmin && (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() => toggleOne(r.id)}
                    aria-label={`تحديد الطلب ${r.request_number}`}
                  />
                )}
                <span>#{r.request_number}</span>
              </div>
              {r.source === "whatsapp" && <span className="badge">واتساب</span>}
              <div className="sub">{r.created_at.slice(0, 10)}</div>
            </div>

            <div>
              <div className="cap">العميل</div>
              <div className="val strong">{r.customer_name}</div>
              <div className="sub">المنطقة: {r.region ?? "—"}</div>
              <div className="sub">
                الرقم الوطني: <span className="ltr">{r.national_id ?? "—"}</span>
              </div>
              {r.beneficiary_number && (
                <div className="sub">
                  رقم المستفيد:{" "}
                  {whatsappLink(r.beneficiary_number) ? (
                    <a
                      className="ltr wa-link"
                      href={whatsappLink(r.beneficiary_number) as string}
                      target="_blank"
                      rel="noreferrer"
                      title="فتح محادثة واتساب مع المستفيد"
                    >
                      💬 {r.beneficiary_number}
                    </a>
                  ) : (
                    <span className="ltr">{r.beneficiary_number}</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="cap">الهاتف</div>
              <div className="val">
                <span className="ltr">{r.phone ?? "—"}</span>
              </div>
              {r.phone2 && (
                <div className="val">
                  <span className="ltr">{r.phone2}</span>
                </div>
              )}
            </div>

            <div>
              <div className="cap">كود المودم</div>
              <div className="val strong">
                {r.modem_code ? <span className="ltr">{r.modem_code}</span> : "—"}
              </div>
              {me?.can_edit && (
                <button
                  type="button"
                  className="btn sm"
                  style={{ marginTop: 4 }}
                  onClick={() =>
                    setPickFor({
                      id: r.id,
                      number: r.request_number,
                      current: r.modem_code,
                    })
                  }
                >
                  {r.modem_code ? "تغيير" : "اختيار مودم"}
                </button>
              )}
              <div className="sub" style={{ marginTop: 6 }}>
                الكود العلوي: <span className="ltr">{r.code1 ?? "—"}</span>
              </div>
              <div className="sub">
                الكود السفلي: <span className="ltr">{r.code2 ?? "—"}</span>
              </div>
            </div>

            <div>
              <div className="cap">المرفقات</div>
              <div className="chips">
                {r.attachments.length === 0 && <span className="sub">—</span>}
                {r.attachments.map((a, i) =>
                  a.url ? (
                    <button
                      key={i}
                      type="button"
                      className="chip"
                      onClick={() =>
                        setPreview({
                          url: a.url as string,
                          label: FILE_LABELS[a.type] ?? "مرفق",
                          name: a.name,
                        })
                      }
                    >
                      🖼 {FILE_LABELS[a.type] ?? "مرفق"}
                    </button>
                  ) : (
                    <span key={i} className="sub">
                      {FILE_LABELS[a.type] ?? a.name}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="status">
              <div className="cap">الحالة</div>
              <select
                value={r.status}
                disabled={!me?.can_change_status}
                onChange={(e) => changeStatus(r.id, e.target.value)}
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <MiniProgress status={r.status} />
            </div>
          </div>

          {r.notes && (
            <div className="note">
              <span className="cap" style={{ display: "block" }}>
                ملاحظات
              </span>
              {r.notes}
            </div>
          )}

          <div className="card-foot">
            <div className="foot-actions">
              {isAdmin && (
                <span className="sub" style={{ marginInlineEnd: 6 }}>
                  مسند إلى:{" "}
                  {r.assigned_to ? (
                    <strong style={{ color: "#111827" }}>{r.assigned_to}</strong>
                  ) : (
                    <span style={{ color: "#b45309" }}>غير مسند</span>
                  )}
                </span>
              )}
              {me?.can_add_note && (
                <button type="button" className="btn sm" onClick={() => startNote(r)}>
                  + ملاحظة
                </button>
              )}
              {me?.can_edit && (
                <button type="button" className="btn sm" onClick={() => startEdit(r)}>
                  تعديل
                </button>
              )}
            </div>
            <div className="foot-actions">
              <button type="button" className="btn sm" onClick={() => copySummary(r)}>
                نسخ الملخص
              </button>
              <button type="button" className="btn sm whatsapp" onClick={() => shareToWhatsApp(r)}>
                إرسال واتساب
              </button>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setAssignTo(r.assigned_to ?? "");
                      setAssignIds([r.id]);
                    }}
                  >
                    إسناد
                  </button>
                  <button type="button" className="btn sm danger" onClick={() => askDelete([r.id])}>
                    حذف
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

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
                <ImageZoom src={preview.url} alt={preview.label} />
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
              placeholder="الكود العلوي"
              style={input}
            />
            <input
              value={editForm.code2}
              onChange={(e) =>
                setEditForm({ ...editForm, code2: e.target.value })
              }
              placeholder="الكود السفلي"
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
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#111",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            zIndex: 50,
            maxWidth: "90vw",
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}
    </main>
  );
}
