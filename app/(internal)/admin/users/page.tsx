"use client"

import { useState, useEffect, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { supabase, getUser, formatDateShort } from "@/lib/supabase"
import type { User, Role } from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────

type TabType = "internal" | "supplier"

const BLANK_ADD_FORM = {
  name: "",
  email: "",
  username: "",
  user_type: "internal" as "internal" | "supplier",
  role_id: "",
  is_active: true,
  password: "",
}

const BLANK_EDIT_FORM = {
  name: "",
  email: "",
  role_id: "",
  is_active: true,
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const router = useRouter()

  // Auth
  const [authChecked, setAuthChecked] = useState(false)

  // Data
  const [users, setUsers] = useState<User[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState("")

  // Tabs & search
  const [activeTab, setActiveTab] = useState<TabType>("internal")
  const [search, setSearch] = useState("")

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ ...BLANK_ADD_FORM })
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState("")

  // Edit modal
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ ...BLANK_EDIT_FORM })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState("")

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toggle active in-progress tracking
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // ── Auth guard ────────────────────────────────────────────────────────────

  useEffect(() => {
    const u = getUser()
    if (
      !u ||
      u.user_type !== "internal" ||
      (u.role as { name?: string } | undefined)?.name !== "admin"
    ) {
      router.replace("/login")
      return
    }
    setAuthChecked(true)
  }, [router])

  // ── Data loading ──────────────────────────────────────────────────────────

  async function loadData() {
    setLoading(true)
    setPageError("")

    const [usersRes, rolesRes] = await Promise.all([
      supabase
        .from("users")
        .select("*, role:roles(id, name)")
        .order("name"),
      supabase.from("roles").select("*").order("name"),
    ])

    if (usersRes.error) {
      setPageError(usersRes.error.message)
    } else {
      setUsers((usersRes.data as User[]) ?? [])
    }

    if (!rolesRes.error) {
      setRoles((rolesRes.data as Role[]) ?? [])
    }

    setLoading(false)
  }

  useEffect(() => {
    if (authChecked) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked])

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    if (u.user_type !== activeTab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q)
    )
  })

  function tabCount(tab: TabType): number {
    return users.filter((u) => u.user_type === tab).length
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggleActive(u: User) {
    setTogglingId(u.id)
    const { error } = await supabase
      .from("users")
      .update({ is_active: !u.is_active, updated_at: new Date().toISOString() })
      .eq("id", u.id)
    if (error) setPageError(error.message)
    else await loadData()
    setTogglingId(null)
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(u: User) {
    setEditTarget(u)
    setEditForm({
      name: u.name,
      email: u.email,
      role_id: u.role_id ?? "",
      is_active: u.is_active,
    })
    setEditError("")
  }

  function closeEdit() {
    setEditTarget(null)
    setEditError("")
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    if (!editForm.name.trim()) { setEditError("Name is required."); return }
    if (!editForm.email.trim()) { setEditError("Email is required."); return }

    setEditSaving(true)
    setEditError("")

    const { error } = await supabase
      .from("users")
      .update({
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role_id: editForm.role_id || null,
        is_active: editForm.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editTarget.id)

    if (error) {
      setEditError(error.message)
      setEditSaving(false)
      return
    }

    setEditSaving(false)
    closeEdit()
    loadData()
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  function openAdd() {
    setAddForm({ ...BLANK_ADD_FORM })
    setAddError("")
    setShowAddModal(true)
  }

  function closeAdd() {
    setShowAddModal(false)
    setAddError("")
  }

  async function handleAddSave(e: FormEvent) {
    e.preventDefault()
    if (!addForm.name.trim()) { setAddError("Name is required."); return }
    if (!addForm.email.trim()) { setAddError("Email is required."); return }
    if (!addForm.password.trim()) { setAddError("Password is required."); return }

    setAddSaving(true)
    setAddError("")

    const { error } = await supabase.from("users").insert([
      {
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        username: addForm.username.trim() || null,
        user_type: addForm.user_type,
        role_id: addForm.role_id || null,
        is_active: addForm.is_active,
        password_hash: addForm.password, // stored as plain text for MVP
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])

    if (error) {
      setAddError(error.message)
      setAddSaving(false)
      return
    }

    setAddSaving(false)
    closeAdd()
    loadData()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error } = await supabase.from("users").delete().eq("id", deleteTarget.id)
    if (error) setPageError(error.message)
    setDeleteTarget(null)
    setDeleting(false)
    loadData()
  }

  // ── Early return ──────────────────────────────────────────────────────────

  if (!authChecked) return null

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">
            Manage internal staff and supplier portal accounts
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + Add User
        </button>
      </div>

      {pageError && (
        <div
          className="alert alert-error"
          style={{ marginBottom: "16px" }}
          role="alert"
        >
          {pageError}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        {(["internal", "supplier"] as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "internal" ? "Internal Users" : "Supplier Users"}
            <span
              style={{
                marginLeft: "5px",
                opacity: 0.65,
                fontWeight: 400,
                fontSize: "12px",
              }}
            >
              ({tabCount(tab)})
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <input
          type="search"
          className="form-input"
          placeholder="Search by name, email, or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: "380px" }}
        />
      </div>

      {/* Table card */}
      <div className="card">
        {loading ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div
            style={{
              padding: "48px",
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            No users found.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email / Username</th>
                <th>Type</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  {/* Name */}
                  <td style={{ fontWeight: 600, color: "var(--text)" }}>
                    {u.name}
                  </td>

                  {/* Email / Username */}
                  <td>
                    <div style={{ fontSize: "13px" }}>{u.email}</div>
                    {u.username && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-muted)",
                          marginTop: "1px",
                        }}
                      >
                        @{u.username}
                      </div>
                    )}
                  </td>

                  {/* Type badge */}
                  <td>
                    <span
                      className={
                        u.user_type === "internal"
                          ? "badge badge-blue"
                          : "badge badge-yellow"
                      }
                    >
                      {u.user_type === "internal" ? "Internal" : "Supplier"}
                    </span>
                  </td>

                  {/* Role */}
                  <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {(u.role as Role | undefined)?.name ?? "—"}
                  </td>

                  {/* Status badge */}
                  <td>
                    <span
                      className={
                        u.is_active ? "badge badge-green" : "badge badge-gray"
                      }
                    >
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                    {u.last_login ? formatDateShort(u.last_login) : "—"}
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: "right" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "6px",
                      }}
                    >
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => openEdit(u)}
                      >
                        Edit
                      </button>
                      <button
                        className={
                          u.is_active
                            ? "btn btn-ghost btn-sm"
                            : "btn btn-outline btn-sm"
                        }
                        disabled={togglingId === u.id}
                        onClick={() => handleToggleActive(u)}
                      >
                        {togglingId === u.id
                          ? "..."
                          : u.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(u)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Edit User Modal ───────────────────────────────────────────────────── */}
      {editTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit()
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "10px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "18px 24px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--text)",
                  }}
                >
                  Edit User
                </h2>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                  }}
                >
                  {editTarget.email}
                </div>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "22px",
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0 4px",
                  fontFamily: "inherit",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal form */}
            <form
              onSubmit={handleEditSave}
              noValidate
              style={{ display: "flex", flexDirection: "column", flex: 1 }}
            >
              <div style={{ padding: "20px 24px", flex: 1 }}>
                {editError && (
                  <div
                    className="alert alert-error"
                    style={{ marginBottom: "16px" }}
                    role="alert"
                  >
                    {editError}
                  </div>
                )}

                {/* Name */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">
                    Full Name{" "}
                    <span style={{ color: "var(--usps-red)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, name: e.target.value }))
                    }
                    autoFocus
                  />
                </div>

                {/* Email */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">
                    Email{" "}
                    <span style={{ color: "var(--usps-red)" }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>

                {/* Role */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={editForm.role_id}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, role_id: e.target.value }))
                    }
                  >
                    <option value="">— No Role —</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Active toggle */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          is_active: e.target.checked,
                        }))
                      }
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Account is active
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  backgroundColor: "#f9fafb",
                  flexShrink: 0,
                  borderRadius: "0 0 10px 10px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeEdit}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSaving}
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add User Modal ────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAdd()
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "10px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: "18px 24px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text)",
                }}
              >
                Add User
              </h2>
              <button
                type="button"
                onClick={closeAdd}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "22px",
                  lineHeight: 1,
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0 4px",
                  fontFamily: "inherit",
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal form */}
            <form
              onSubmit={handleAddSave}
              noValidate
              style={{ display: "flex", flexDirection: "column", flex: 1 }}
            >
              <div style={{ padding: "20px 24px", flex: 1 }}>
                {addError && (
                  <div
                    className="alert alert-error"
                    style={{ marginBottom: "16px" }}
                    role="alert"
                  >
                    {addError}
                  </div>
                )}

                {/* Name */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">
                    Full Name{" "}
                    <span style={{ color: "var(--usps-red)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Jane Smith"
                    autoFocus
                  />
                </div>

                {/* Email */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">
                    Email{" "}
                    <span style={{ color: "var(--usps-red)" }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    value={addForm.email}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="jane.smith@usps.gov"
                  />
                </div>

                {/* Username */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    value={addForm.username}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="jsmith (optional)"
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">
                    Password{" "}
                    <span style={{ color: "var(--usps-red)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={addForm.password}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="Initial password"
                  />
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      marginTop: "4px",
                    }}
                  >
                    Admin-set initial password. User should change it after
                    first login.
                  </div>
                </div>

                {/* User Type */}
                <div style={{ marginBottom: "14px" }}>
                  <label className="form-label">User Type</label>
                  <select
                    className="form-select"
                    value={addForm.user_type}
                    onChange={(e) =>
                      setAddForm((p) => ({
                        ...p,
                        user_type: e.target.value as "internal" | "supplier",
                        role_id: "",
                      }))
                    }
                  >
                    <option value="internal">Internal</option>
                    <option value="supplier">Supplier</option>
                  </select>
                </div>

                {/* Role — internal users only */}
                {addForm.user_type === "internal" && (
                  <div style={{ marginBottom: "14px" }}>
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={addForm.role_id}
                      onChange={(e) =>
                        setAddForm((p) => ({ ...p, role_id: e.target.value }))
                      }
                    >
                      <option value="">— No Role —</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Active toggle */}
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={addForm.is_active}
                      onChange={(e) =>
                        setAddForm((p) => ({
                          ...p,
                          is_active: e.target.checked,
                        }))
                      }
                      style={{ width: "16px", height: "16px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: 600 }}>
                      Account is active
                    </span>
                  </label>
                </div>
              </div>

              {/* Modal footer */}
              <div
                style={{
                  padding: "14px 24px",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  backgroundColor: "#f9fafb",
                  flexShrink: 0,
                  borderRadius: "0 0 10px 10px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeAdd}
                  disabled={addSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={addSaving}
                >
                  {addSaving ? "Creating..." : "Add User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: "10px",
              boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
              width: "100%",
              maxWidth: "420px",
              padding: "28px",
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--text)",
              }}
            >
              Delete User
            </h2>
            <p
              style={{
                margin: "0 0 6px",
                color: "var(--text)",
                fontSize: "14px",
              }}
            >
              Are you sure you want to delete{" "}
              <strong>{deleteTarget.name}</strong>?
            </p>
            <p
              style={{
                margin: "0 0 24px",
                color: "var(--text-muted)",
                fontSize: "13px",
              }}
            >
              This action cannot be undone and will permanently remove this
              user account.
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
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
                {deleting ? "Deleting..." : "Delete User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
