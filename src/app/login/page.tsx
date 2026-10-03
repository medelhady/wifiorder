export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 360,
        margin: "80px auto",
        padding: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 16 }}>طلبات الويفي</h1>
      <form
        method="POST"
        action="/api/login"
        style={{ display: "grid", gap: 12 }}
      >
        <input
          type="text"
          name="username"
          placeholder="اسم المستخدم (للأدمن اكتب admin)"
          autoComplete="username"
          style={{ padding: 10, fontSize: 16 }}
        />
        <input
          type="password"
          name="password"
          placeholder="كلمة السر"
          required
          autoComplete="current-password"
          style={{ padding: 10, fontSize: 16 }}
        />
        <button type="submit" style={{ padding: 10, fontSize: 16 }}>
          دخول
        </button>
        {error && (
          <p style={{ color: "crimson" }}>اسم المستخدم أو كلمة السر غير صحيحة</p>
        )}
      </form>
    </main>
  );
}
