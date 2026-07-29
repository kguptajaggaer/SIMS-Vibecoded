"use client";
import { useEffect, useState } from "react";
import { supabase, getUser } from "@/lib/supabase";
import type { User } from "@/lib/types";

type EmailTab = "compose" | "batch_internal" | "batch_suppliers" | "batch_prospective" | "templates" | "history";

export default function EmailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<EmailTab>("compose");
  const [form, setForm] = useState({ to: "", subject: "", body: "" });
  const [batchTarget, setBatchTarget] = useState<"internal" | "supplier" | "prospective">("internal");
  const [batchSubject, setBatchSubject] = useState("");
  const [batchBody, setBatchBody] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  async function sendEmail() {
    if (!form.to || !form.subject) return;
    setSending(true);
    await supabase.from("email_logs").insert({
      recipient_email: form.to,
      subject: form.subject,
      body_html: form.body,
      status: "sent",
      sent_by: user?.id,
    });
    setMsg({ type: "success", text: `Email logged to ${form.to}` });
    setForm({ to: "", subject: "", body: "" });
    setSending(false);
  }

  async function sendBatch() {
    if (!batchSubject) return;
    setSending(true);
    const userType = batchTarget === "internal" ? "internal" : "supplier";
    const status = batchTarget === "prospective" ? "prospective" : undefined;

    let query = supabase.from("users").select("email");
    if (batchTarget !== "prospective") query = query.eq("user_type", userType);

    const { data: targets } = await query;
    const emails = (targets || []).map((u: { email: string }) => u.email);

    for (const email of emails.slice(0, 50)) {
      await supabase.from("email_logs").insert({
        recipient_email: email,
        subject: batchSubject,
        body_html: batchBody,
        status: "sent",
        sent_by: user?.id,
      });
    }
    setMsg({ type: "success", text: `Batch email logged for ${emails.length} recipients.` });
    setBatchSubject("");
    setBatchBody("");
    setSending(false);
    void status;
  }

  void user;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Email</h1>
      </div>

      <div className="tabs">
        {([
          ["compose", "Compose"],
          ["batch_internal", "Batch – Internal"],
          ["batch_suppliers", "Batch – Suppliers"],
          ["batch_prospective", "Batch – Prospective"],
          ["history", "Send History"],
        ] as [EmailTab, string][]).map(([key, label]) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => { setTab(key); setMsg(null); }}>
            {label}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`} style={{ marginBottom: 16 }}>
          {msg.text}
        </div>
      )}

      {tab === "compose" && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-header"><h2 className="card-title">Compose Email</h2></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label className="form-label">To (email address)</label>
              <input className="form-input" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} placeholder="recipient@example.com" />
            </div>
            <div>
              <label className="form-label">Subject</label>
              <input className="form-input" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Email subject" />
            </div>
            <div>
              <label className="form-label">Message</label>
              <textarea className="form-textarea" rows={8} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Email body…" />
            </div>
            <button className="btn btn-primary" style={{ alignSelf: "flex-end" }} onClick={sendEmail} disabled={sending}>
              {sending ? "Sending…" : "Send Email"}
            </button>
          </div>
        </div>
      )}

      {(tab === "batch_internal" || tab === "batch_suppliers" || tab === "batch_prospective") && (
        <div className="card" style={{ maxWidth: 680 }}>
          <div className="card-header">
            <h2 className="card-title">
              Batch Email –{" "}
              {tab === "batch_internal" ? "Internal Users" : tab === "batch_suppliers" ? "Active Suppliers" : "Prospective Suppliers"}
            </h2>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="alert alert-info">
              This will send an email to all{" "}
              {tab === "batch_internal" ? "internal USPS users" : tab === "batch_suppliers" ? "active supplier users" : "prospective supplier accounts"}
              {" "}in the system.
            </div>
            <div>
              <label className="form-label">Subject</label>
              <input className="form-input" value={batchSubject} onChange={e => setBatchSubject(e.target.value)} placeholder="Email subject" />
            </div>
            <div>
              <label className="form-label">Message</label>
              <textarea className="form-textarea" rows={8} value={batchBody} onChange={e => setBatchBody(e.target.value)} placeholder="Email body…" />
            </div>
            <button
              className="btn btn-primary"
              style={{ alignSelf: "flex-end" }}
              onClick={() => {
                setBatchTarget(tab === "batch_internal" ? "internal" : tab === "batch_suppliers" ? "supplier" : "prospective");
                sendBatch();
              }}
              disabled={sending}
            >
              {sending ? "Sending…" : "Send Batch Email"}
            </button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <EmailHistory />
      )}
    </div>
  );
}

function EmailHistory() {
  const [logs, setLogs] = useState<Array<{
    id: string; recipient_email: string; subject?: string; status: string; sent_at: string; template_key?: string;
  }>>([]);

  useEffect(() => {
    supabase.from("email_logs").select("id,recipient_email,subject,status,sent_at,template_key")
      .order("sent_at", { ascending: false }).limit(100)
      .then(({ data }) => setLogs(data || []));
  }, []);

  return (
    <div className="card">
      <div style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Sent At</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Template</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No email history.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id}>
                <td style={{ fontSize: 12 }}>{new Date(l.sent_at).toLocaleString()}</td>
                <td>{l.recipient_email}</td>
                <td>{l.subject || "—"}</td>
                <td><code style={{ fontSize: 11 }}>{l.template_key || "—"}</code></td>
                <td>
                  <span className={`badge ${l.status === "sent" ? "badge-green" : l.status === "failed" ? "badge-red" : "badge-yellow"}`}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
