"use client"

import { useState } from "react"

type Setting = {
  key: string
  label: string
  description: string
  value: string
  type: "text" | "email" | "number" | "textarea" | "select"
  options?: string[]
  group: string
}

const SETTINGS: Setting[] = [
  {
    group: "System",
    key: "site_name",
    label: "System Name",
    description: "The name displayed in the browser title and throughout the application.",
    type: "text",
    value: "SIMS – Supplier Information Management System",
  },
  {
    group: "System",
    key: "reporting_period",
    label: "Current Reporting Period",
    description: "The active reporting period used on the dashboard and reports.",
    type: "text",
    value: "2025 MDFY",
  },
  {
    group: "System",
    key: "default_currency",
    label: "Default Currency",
    description: "Currency used for spend amounts throughout the system.",
    type: "select",
    options: ["USD", "EUR", "GBP", "CAD"],
    value: "USD",
  },
  {
    group: "Email",
    key: "from_email",
    label: "System From Email",
    description: "Email address used as the sender for all system-generated emails.",
    type: "email",
    value: "noreply@usps.gov",
  },
  {
    group: "Email",
    key: "support_email",
    label: "Support Email",
    description: "Email address displayed for user support requests.",
    type: "email",
    value: "sims-support@usps.gov",
  },
  {
    group: "Email",
    key: "approval_reminder_days",
    label: "Approval Reminder (Days)",
    description: "Number of days before sending reminder emails for pending approvals.",
    type: "number",
    value: "7",
  },
  {
    group: "Supplier",
    key: "supplier_registration_enabled",
    label: "Supplier Registration",
    description: "Allow new suppliers to register through the supplier portal.",
    type: "select",
    options: ["Enabled", "Disabled"],
    value: "Enabled",
  },
  {
    group: "Supplier",
    key: "supplier_portal_url",
    label: "Supplier Portal URL",
    description: "Public URL for the supplier portal login page.",
    type: "text",
    value: "https://sims.usps.gov/supplier/login",
  },
]

export default function GeneralPage() {
  const [settings, setSettings] = useState<Setting[]>(SETTINGS)
  const [saved, setSaved] = useState(false)

  const groups = Array.from(new Set(settings.map(s => s.group)))

  function handleChange(key: string, val: string) {
    setSettings(prev => prev.map(s => (s.key === key ? { ...s, value: val } : s)))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">General Settings</h1>
          <p className="page-subtitle">Configure system-wide settings for SIMS.</p>
        </div>
        <button
          onClick={handleSave}
          style={{
            backgroundColor: saved ? "#16a34a" : "#004B87",
            color: "white",
            border: "none",
            borderRadius: 5,
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
        >
          {saved ? "✓ Saved" : "Save Changes"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {groups.map(group => (
          <div
            key={group}
            style={{
              backgroundColor: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            {/* Group header */}
            <div
              style={{
                backgroundColor: "#004B87",
                color: "white",
                padding: "8px 16px",
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              {group} Settings
            </div>

            {/* Settings */}
            <div>
              {settings
                .filter(s => s.group === group)
                .map((s, idx, arr) => (
                  <div
                    key={s.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "280px 1fr",
                      gap: 20,
                      padding: "14px 20px",
                      alignItems: "start",
                      borderBottom: idx < arr.length - 1 ? "1px solid #f0f2f5" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#1a2332", marginBottom: 3 }}>
                        {s.label}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>
                        {s.description}
                      </div>
                    </div>
                    <div>
                      {s.type === "textarea" ? (
                        <textarea
                          value={s.value}
                          onChange={e => handleChange(s.key, e.target.value)}
                          rows={3}
                          style={{
                            width: "100%",
                            border: "1px solid #d1d9e6",
                            borderRadius: 4,
                            padding: "7px 10px",
                            fontSize: 13,
                            outline: "none",
                            boxSizing: "border-box",
                            resize: "vertical",
                          }}
                        />
                      ) : s.type === "select" ? (
                        <select
                          value={s.value}
                          onChange={e => handleChange(s.key, e.target.value)}
                          style={{
                            border: "1px solid #d1d9e6",
                            borderRadius: 4,
                            padding: "7px 10px",
                            fontSize: 13,
                            outline: "none",
                            minWidth: 160,
                          }}
                        >
                          {s.options?.map(o => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={s.type}
                          value={s.value}
                          onChange={e => handleChange(s.key, e.target.value)}
                          style={{
                            width: "100%",
                            maxWidth: 400,
                            border: "1px solid #d1d9e6",
                            borderRadius: 4,
                            padding: "7px 10px",
                            fontSize: 13,
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
