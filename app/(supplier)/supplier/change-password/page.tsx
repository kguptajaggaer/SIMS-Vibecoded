"use client";
import { useState } from "react";
import { getUser } from "@/lib/supabase";

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!current.trim()) { setMsg({ type: "error", text: "Current password is required." }); return; }
    if (next.length < 8) { setMsg({ type: "error", text: "New password must be at least 8 characters." }); return; }
    if (next !== confirm) { setMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (!/[A-Z]/.test(next)) { setMsg({ type: "error", text: "New password must contain at least one uppercase letter." }); return; }
    if (!/[0-9]/.test(next)) { setMsg({ type: "error", text: "New password must contain at least one number." }); return; }

    const user = getUser();
    if (!user) { setMsg({ type: "error", text: "Session expired. Please log in again." }); return; }

    setSaving(true);

    const res = await fetch("/api/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, currentPassword: current, newPassword: next }),
    });
    const json = await res.json();
    const error = res.ok ? null : json;

    if (error) {
      setMsg({ type: "error", text: json.error || "Failed to update password." });
    } else {
      setMsg({ type: "success", text: "Password changed successfully." });
      setCurrent(""); setNext(""); setConfirm("");
    }
    setSaving(false);
  }

  const strength = (() => {
    if (!next) return null;
    let score = 0;
    if (next.length >= 8) score++;
    if (next.length >= 12) score++;
    if (/[A-Z]/.test(next)) score++;
    if (/[0-9]/.test(next)) score++;
    if (/[^A-Za-z0-9]/.test(next)) score++;
    if (score <= 2) return { label: "Weak", color: "#ef4444" };
    if (score <= 3) return { label: "Fair", color: "#f59e0b" };
    if (score <= 4) return { label: "Good", color: "#3b82f6" };
    return { label: "Strong", color: "#16a34a" };
  })();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Change Password</h1>
          <p className="page-subtitle">Update your account password</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-header">
          <h2 className="card-title">Password Settings</h2>
        </div>
        <div className="card-body">
          {msg && (
            <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
              {msg.text}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="form-label">Current Password *</label>
              <input
                type="password"
                className="form-input"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="form-label">New Password *</label>
              <input
                type="password"
                className="form-input"
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
              />
              {strength && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <div style={{ display: "flex", gap: 3, flex: 1 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} style={{
                        height: 4, flex: 1, borderRadius: 2,
                        background: i <= (
                          strength.label === "Weak" ? 1 :
                          strength.label === "Fair" ? 2 :
                          strength.label === "Good" ? 3 : 5
                        ) ? strength.color : "#e2e8f0",
                        transition: "background 0.2s",
                      }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: strength.color, fontWeight: 600, minWidth: 44 }}>
                    {strength.label}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>
                Must be at least 8 characters with one uppercase letter and one number.
              </div>
            </div>

            <div>
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                className="form-input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                style={{ borderColor: confirm && next !== confirm ? "#ef4444" : undefined }}
              />
              {confirm && next !== confirm && (
                <div style={{ fontSize: 12, color: "#ef4444", marginTop: 4 }}>Passwords do not match.</div>
              )}
            </div>

            <div style={{ paddingTop: 4 }}>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "100%" }}>
                {saving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
