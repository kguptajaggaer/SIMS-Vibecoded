"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase, getUser } from "@/lib/supabase"
import type { Role, Permission } from "@/lib/types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleWithCount extends Role {
  permissions_count: number
}

type ModalMode = "create" | "edit" | null

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "Content",
  "Email",
  "SubK Compliance",
  "Supplier Management",
  "EPP",
  "Supplier Performance",
  "Admin",
]

// ─── Indeterminate checkbox helper ───────────────────────────────────────────

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ cursor: "pointer", width: 15, height: 15, flexShrink: 0 }}
    />
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  // ── Data state
  const [roles, setRoles] = useState<RoleWithCount[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  // ── Feedback
  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")

  // ── Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingRole, setEditingRole] = useState<RoleWithCount | null>(null)
  const [modalError, setModalError] = useState("")

  // ── Form
  const [formName, setFormName] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)

  // ── Delete
  const [deleteTarget, setDeleteTarget] = useState<RoleWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  // ── Auth guard (page-level check)
  useEffect(() => {
    const u = getUser()
    if (!u || u.user_type !== "internal") {
      window.location.replace("/login")
    }
  }, [])

  // ─── Loaders ─────────────────────────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [{ data: rolesData, error: rolesErr }, { data: rpData, error: rpErr }] =
        await Promise.all([
          supabase.from("roles").select("*").order("name"),
          supabase.from("role_permissions").select("role_id"),
        ])

      if (rolesErr) throw rolesErr
      if (rpErr) throw rpErr

      const countMap: Record<string, number> = {}
      for (const row of rpData || []) {
        countMap[row.role_id] = (countMap[row.role_id] || 0) + 1
      }

      setRoles(
        (rolesData || []).map((r: Role) => ({
          ...r,
          permissions_count: countMap[r.id] || 0,
        }))
      )
    } catch (e: unknown) {
      setError((e as Error).message || "Failed to load roles.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPermissions = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("permissions")
      .select("*")
      .order("category, label")
    if (!err) setPermissions(data || [])
  }, [])

  useEffect(() => {
    loadRoles()
    loadPermissions()
  }, [loadRoles, loadPermissions])

  // ─── Derived: permissions grouped by category ─────────────────────────────

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    acc[p.category] = acc[p.category] || []
    acc[p.category].push(p)
    return acc
  }, {})

  const categoryOrder = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped)
      .filter((c) => !CATEGORY_ORDER.includes(c))
      .sort(),
  ]

  // ─── Modal helpers ────────────────────────────────────────────────────────

  function flash(msg: string) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(""), 3500)
  }

  function openCreate() {
    setFormName("")
    setFormDescription("")
    setSelectedPermIds(new Set())
    setModalError("")
    setEditingRole(null)
    setModalMode("create")
  }

  async function openEdit(role: RoleWithCount) {
    setFormName(role.name)
    setFormDescription(role.description || "")
    setSelectedPermIds(new Set())
    setModalError("")
    setEditingRole(role)
    setModalMode("edit")
    setLoadingPerms(true)

    const { data, error: err } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", role.id)

    setLoadingPerms(false)
    if (err) {
      setModalError("Failed to load role permissions.")
      return
    }
    setSelectedPermIds(
      new Set((data || []).map((r: { permission_id: string }) => r.permission_id))
    )
  }

  function closeModal() {
    setModalMode(null)
    setEditingRole(null)
    setModalError("")
  }

  // ─── Permission toggles ───────────────────────────────────────────────────

  function togglePerm(permId: string) {
    setSelectedPermIds((prev) => {
      const next = new Set(prev)
      if (next.has(permId)) next.delete(permId)
      else next.add(permId)
      return next
    })
  }

  function toggleCategory(catPerms: Permission[], checked: boolean) {
    setSelectedPermIds((prev) => {
      const next = new Set(prev)
      for (const p of catPerms) {
        if (checked) next.add(p.id)
        else next.delete(p.id)
      }
      return next
    })
  }

  // ─── Save (create or edit) ────────────────────────────────────────────────

  async function handleSave() {
    if (!formName.trim()) {
      setModalError("Role name is required.")
      return
    }
    setSaving(true)
    setModalError("")

    try {
      let roleId: string

      if (modalMode === "create") {
        const { data, error: err } = await supabase
          .from("roles")
          .insert({
            name: formName.trim(),
            description: formDescription.trim() || null,
            is_system_role: false,
          })
          .select()
          .single()
        if (err) throw err
        roleId = data.id
      } else {
        const { error: err } = await supabase
          .from("roles")
          .update({
            name: formName.trim(),
            description: formDescription.trim() || null,
          })
          .eq("id", editingRole!.id)
        if (err) throw err
        roleId = editingRole!.id

        // Clear existing permissions before re-inserting
        const { error: delErr } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role_id", roleId)
        if (delErr) throw delErr
      }

      // Insert selected permissions
      if (selectedPermIds.size > 0) {
        const rows = Array.from(selectedPermIds).map((pid) => ({
          role_id: roleId,
          permission_id: pid,
        }))
        const { error: insErr } = await supabase
          .from("role_permissions")
          .insert(rows)
        if (insErr) throw insErr
      }

      closeModal()
      await loadRoles()
      flash(
        modalMode === "create"
          ? "Role created successfully."
          : "Role updated successfully."
      )
    } catch (e: unknown) {
      setModalError((e as Error).message || "Failed to save role.")
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError("")

    try {
      const { error: err } = await supabase
        .from("roles")
        .delete()
        .eq("id", deleteTarget.id)
      if (err) throw err

      setDeleteTarget(null)
      await loadRoles()
      flash("Role deleted.")
    } catch (e: unknown) {
      setDeleteError((e as Error).message || "Failed to delete role.")
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Roles</h1>
          <p className="page-subtitle">
            Manage roles and their permission assignments.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          + Create Role
        </button>
      </div>

      {/* ── Page-level feedback ─────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      {/* ── Roles table ─────────────────────────────────────────────────── */}
      <div className="card">
        {loading ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            Loading roles…
          </div>
        ) : roles.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 14,
            }}
          >
            No roles defined. Click &ldquo;+ Create Role&rdquo; to add one.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Type</th>
                <th style={{ textAlign: "center" }}>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <td style={{ fontWeight: 600 }}>{role.name}</td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {role.description || "—"}
                  </td>
                  <td>
                    {role.is_system_role ? (
                      <span className="badge badge-blue">System</span>
                    ) : (
                      <span className="badge badge-gray">Custom</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        minWidth: 28,
                        padding: "2px 8px",
                        borderRadius: 100,
                        background: "#f1f5f9",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {role.permissions_count}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEdit(role)}
                      >
                        Edit
                      </button>
                      {!role.is_system_role && (
                        <button
                          className="btn btn-sm"
                          style={{
                            background: "var(--danger-bg)",
                            color: "var(--danger)",
                            border: "1.5px solid #fca5a5",
                          }}
                          onClick={() => {
                            setDeleteError("")
                            setDeleteTarget(role)
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit modal ──────────────────────────────────────────── */}
      {modalMode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "40px 16px 40px",
            zIndex: 1000,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 10,
              width: "100%",
              maxWidth: 680,
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {/* Modal header */}
            <div
              style={{
                background: "var(--usps-blue)",
                padding: "15px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  color: "white",
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                }}
              >
                {modalMode === "create"
                  ? "Create Role"
                  : `Edit Role — ${editingRole?.name}`}
              </h2>
              <button
                onClick={closeModal}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.8)",
                  cursor: "pointer",
                  fontSize: 22,
                  lineHeight: 1,
                  padding: "0 2px",
                  fontFamily: "inherit",
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "24px 24px 20px" }}>
              {modalError && (
                <div
                  className="alert alert-error"
                  style={{ marginBottom: 16 }}
                >
                  {modalError}
                </div>
              )}

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">
                  Role Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Contract Officer"
                  disabled={saving}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: 22 }}>
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of this role's responsibilities"
                  disabled={saving}
                />
              </div>

              {/* Permissions matrix */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <label className="form-label" style={{ margin: 0 }}>
                    Permissions
                  </label>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontWeight: 600,
                    }}
                  >
                    {selectedPermIds.size} of {permissions.length} selected
                  </span>
                </div>

                {loadingPerms ? (
                  <div
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: 13,
                      border: "1.5px solid var(--border)",
                      borderRadius: 8,
                    }}
                  >
                    Loading permissions…
                  </div>
                ) : permissions.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    No permissions are defined in the system yet.
                  </p>
                ) : (
                  <div
                    style={{
                      border: "1.5px solid var(--border)",
                      borderRadius: 8,
                      overflow: "hidden",
                      maxHeight: 400,
                      overflowY: "auto",
                    }}
                  >
                    {categoryOrder.map((category, ci) => {
                      const catPerms = grouped[category] || []
                      const selectedCount = catPerms.filter((p) =>
                        selectedPermIds.has(p.id)
                      ).length
                      const allChecked = selectedCount === catPerms.length
                      const someChecked = selectedCount > 0 && !allChecked

                      return (
                        <div key={category}>
                          {/* Category header row */}
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "9px 14px",
                              borderTop:
                                ci > 0
                                  ? "1px solid var(--border)"
                                  : "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <IndeterminateCheckbox
                              checked={allChecked}
                              indeterminate={someChecked}
                              onChange={(e) =>
                                toggleCategory(catPerms, e.target.checked)
                              }
                            />
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                color: "var(--usps-blue)",
                              }}
                            >
                              {category}
                            </span>
                            <span
                              style={{
                                marginLeft: "auto",
                                fontSize: 11,
                                color: "var(--text-muted)",
                                fontWeight: 600,
                              }}
                            >
                              {selectedCount}/{catPerms.length}
                            </span>
                          </div>

                          {/* Permission rows */}
                          {catPerms.map((perm) => {
                            const isChecked = selectedPermIds.has(perm.id)
                            return (
                              <label
                                key={perm.id}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 10,
                                  padding: "8px 14px 8px 30px",
                                  borderTop: "1px solid #f0f4f8",
                                  cursor: "pointer",
                                  background: isChecked
                                    ? "#f0f7ff"
                                    : "white",
                                  transition: "background 0.1s",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePerm(perm.id)}
                                  disabled={saving}
                                  style={{
                                    marginTop: 2,
                                    cursor: "pointer",
                                    width: 14,
                                    height: 14,
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: 13,
                                      color: "var(--text)",
                                      lineHeight: "1.3",
                                    }}
                                  >
                                    {perm.label}
                                  </div>
                                  {perm.description && (
                                    <div
                                      style={{
                                        fontSize: 12,
                                        color: "var(--text-muted)",
                                        marginTop: 1,
                                        lineHeight: "1.4",
                                      }}
                                    >
                                      {perm.description}
                                    </div>
                                  )}
                                  <code
                                    style={{
                                      fontSize: 11,
                                      color: "#94a3b8",
                                      display: "block",
                                      marginTop: 2,
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {perm.permission_key}
                                  </code>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 22,
                  paddingTop: 18,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || loadingPerms}
                >
                  {saving
                    ? "Saving…"
                    : modalMode === "create"
                    ? "Create Role"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ────────────────────────────────────── */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting)
              setDeleteTarget(null)
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 10,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "var(--danger)",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ color: "white", fontSize: 18, lineHeight: 1 }}>
                &#9888;
              </span>
              <h2
                style={{
                  color: "white",
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                Delete Role
              </h2>
            </div>

            <div style={{ padding: "22px 22px 18px" }}>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 14,
                  color: "var(--text)",
                  lineHeight: "1.5",
                }}
              >
                Are you sure you want to delete{" "}
                <strong>{deleteTarget.name}</strong>? All permission assignments
                for this role will also be removed. Any users assigned this role
                will lose access.
              </p>

              {deleteError && (
                <div
                  className="alert alert-error"
                  style={{ marginBottom: 14 }}
                >
                  {deleteError}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  className="btn btn-ghost"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
