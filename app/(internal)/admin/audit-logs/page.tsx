"use client";
import { useEffect, useState } from "react";
import { supabase, getUser, formatDate } from "@/lib/supabase";
import type { User } from "@/lib/types";

type LogTab = "all" | "users" | "emails" | "pages";

interface AuditEntry {
  id: string;
  action: string;
  object_type?: string;
  object_label?: string;
  ip_address?: string;
  created_at: string;
  users?: { name: string; email: string };
}

interface EmailEntry {
  id: string;
  template_key?: string;
  recipient_email: string;
  subject?: string;
  status: string;
  sent_at: string;
}

export default function AuditLogs() {
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<LogTab>("all");
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    setLoading(true);
    if (tab === "all" || tab === "users" || tab === "pages") {
      let query = supabase
        .from("audit_logs")
        .select("*, users(name,email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (tab === "users") query = query.eq("object_type", "user");
      if (tab === "pages") query = query.eq("action", "view");
      const { data } = await query;
      setAuditLogs(data || []);
    } else if (tab === "emails") {
      const { data } = await supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);
      setEmailLogs(data || []);
    }
    setLoading(false);
  }

  const filteredAudit = auditLogs.filter(l =>
    !search ||
    l.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.object_type?.toLowerCase().includes(search.toLowerCase()) ||
    l.object_label?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmail = emailLogs.filter(l =>
    !search ||
    l.recipient_email?.toLowerCase().includes(search.toLowerCase()) ||
    l.subject?.toLowerCase().includes(search.toLowerCase())
  );

  void user;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">System activity and email history</p>
        </div>
        <input
          className="form-input"
          style={{ width: 280 }}
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="tabs">
        {([
          ["all", "All Activity"],
          ["users", "User Access"],
          ["emails", "Email History"],
          ["pages", "Page Access"],
        ] as [LogTab, string][]).map(([key, label]) => (
          <button key={key} className={`tab${tab === key ? " active" : ""}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading logs…</div>
      ) : tab === "emails" ? (
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
                {filteredEmail.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No email logs found.</td></tr>
                ) : filteredEmail.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12 }}>{formatDate(l.sent_at)}</td>
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
      ) : (
        <div className="card">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Object Type</th>
                  <th>Object</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No audit logs found.</td></tr>
                ) : filteredAudit.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(l.created_at)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{l.users?.name || "System"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.users?.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        l.action === "create" ? "badge-green" :
                        l.action === "delete" ? "badge-red" :
                        l.action === "update" ? "badge-yellow" :
                        "badge-gray"
                      }`}>{l.action}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{l.object_type || "—"}</td>
                    <td style={{ fontSize: 12 }}>{l.object_label || "—"}</td>
                    <td style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.ip_address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
