"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkflowRow {
  id: string;
  name: string;
  object_type: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  steps_count: number;
}

interface WfStatus {
  id: string;
  workflow_id: string;
  status_key: string;
  label: string;
  description?: string;
  is_initial: boolean;
  is_terminal: boolean;
  sort_order: number;
}

interface WfStep {
  id: string;
  workflow_id: string;
  from_status_id?: string | null;
  to_status_id?: string | null;
  action_label?: string;
  required_permission?: string;
  auto_email_template?: string;
  sort_order: number;
}

// ── Blank form helpers ────────────────────────────────────────────────────────

type WfFormData = {
  name: string;
  object_type: string;
  description: string;
  is_active: boolean;
};

type StatusFormData = Omit<WfStatus, "id">;
type StepFormData = Omit<WfStep, "id">;

function blankWorkflow(): WfFormData {
  return { name: "", object_type: "", description: "", is_active: true };
}

function blankStatus(workflow_id: string): StatusFormData {
  return {
    workflow_id,
    status_key: "",
    label: "",
    description: "",
    is_initial: false,
    is_terminal: false,
    sort_order: 0,
  };
}

function blankStep(workflow_id: string): StepFormData {
  return {
    workflow_id,
    from_status_id: null,
    to_status_id: null,
    action_label: "",
    required_permission: "",
    auto_email_template: "",
    sort_order: 0,
  };
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          width: "100%",
          maxWidth: 540,
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          overflow: "hidden",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            background: "var(--usps-blue)",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "white", fontWeight: 700, fontSize: 15 }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "white",
              fontSize: 22,
              cursor: "pointer",
              lineHeight: 1,
              padding: "0 2px",
              fontFamily: "inherit",
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ padding: "20px 24px 24px", overflowY: "auto" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Field group ───────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
      {hint && (
        <span
          style={{
            display: "block",
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 3,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  // ── View state ────────────────────────────────────────────────────────
  type View = "list" | "edit";
  const [view, setView] = useState<View>("list");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRow | null>(
    null
  );

  // ── List data ─────────────────────────────────────────────────────────
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");

  // ── Edit data ─────────────────────────────────────────────────────────
  const [statuses, setStatuses] = useState<WfStatus[]>([]);
  const [steps, setSteps] = useState<WfStep[]>([]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Modal state ───────────────────────────────────────────────────────
  type ModalKind = "workflow" | "status" | "step" | null;
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");

  // ── Form data ─────────────────────────────────────────────────────────
  const [wfForm, setWfForm] = useState<WfFormData>(blankWorkflow());
  const [statusForm, setStatusForm] = useState<StatusFormData>(
    blankStatus("")
  );
  const [stepForm, setStepForm] = useState<StepFormData>(blankStep(""));

  // ── Load workflow list ────────────────────────────────────────────────

  const loadWorkflows = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const { data: wfData, error: wfErr } = await supabase
        .from("workflows")
        .select("*")
        .order("name");
      if (wfErr) throw wfErr;

      const { data: stepData, error: stErr } = await supabase
        .from("workflow_steps")
        .select("workflow_id");
      if (stErr) throw stErr;

      const countMap: Record<string, number> = {};
      for (const s of stepData || []) {
        countMap[s.workflow_id] = (countMap[s.workflow_id] || 0) + 1;
      }

      setWorkflows(
        (wfData || []).map(
          (w: Omit<WorkflowRow, "steps_count">) => ({
            ...w,
            steps_count: countMap[w.id] || 0,
          })
        )
      );
    } catch (err: unknown) {
      setListError(
        err instanceof Error ? err.message : "Failed to load workflows."
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  // ── Load statuses + steps for the selected workflow ───────────────────

  const loadWorkflowData = useCallback(async (wfId: string) => {
    setLoadingEdit(true);
    setEditError("");
    try {
      const [sRes, tRes] = await Promise.all([
        supabase
          .from("workflow_statuses")
          .select("*")
          .eq("workflow_id", wfId)
          .order("sort_order"),
        supabase
          .from("workflow_steps")
          .select("*")
          .eq("workflow_id", wfId)
          .order("sort_order"),
      ]);
      if (sRes.error) throw sRes.error;
      if (tRes.error) throw tRes.error;
      setStatuses(sRes.data || []);
      setSteps(tRes.data || []);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error ? err.message : "Failed to load workflow data."
      );
    } finally {
      setLoadingEdit(false);
    }
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────

  function openEdit(wf: WorkflowRow) {
    setSelectedWorkflow(wf);
    loadWorkflowData(wf.id);
    setView("edit");
  }

  function backToList() {
    setView("list");
    setSelectedWorkflow(null);
    setStatuses([]);
    setSteps([]);
    loadWorkflows();
  }

  // ── Open modals ───────────────────────────────────────────────────────

  function openAddWorkflow() {
    setWfForm(blankWorkflow());
    setEditingId(null);
    setModalError("");
    setModal("workflow");
  }

  function openEditWorkflow(wf: WorkflowRow) {
    setWfForm({
      name: wf.name,
      object_type: wf.object_type,
      description: wf.description || "",
      is_active: wf.is_active,
    });
    setEditingId(wf.id);
    setModalError("");
    setModal("workflow");
  }

  function openAddStatus() {
    setStatusForm(blankStatus(selectedWorkflow!.id));
    setEditingId(null);
    setModalError("");
    setModal("status");
  }

  function openEditStatus(s: WfStatus) {
    setStatusForm({ ...s });
    setEditingId(s.id);
    setModalError("");
    setModal("status");
  }

  function openAddStep() {
    setStepForm(blankStep(selectedWorkflow!.id));
    setEditingId(null);
    setModalError("");
    setModal("step");
  }

  function openEditStep(s: WfStep) {
    setStepForm({ ...s });
    setEditingId(s.id);
    setModalError("");
    setModal("step");
  }

  function closeModal() {
    setModal(null);
    setEditingId(null);
    setModalError("");
  }

  // ── Save workflow ─────────────────────────────────────────────────────

  async function saveWorkflow() {
    if (!wfForm.name.trim() || !wfForm.object_type.trim()) {
      setModalError("Name and Object Type are required.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      if (editingId) {
        const { error } = await supabase
          .from("workflows")
          .update({ ...wfForm, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
        // Update selected workflow in-place when editing from edit view
        if (selectedWorkflow && selectedWorkflow.id === editingId) {
          setSelectedWorkflow((prev) =>
            prev ? { ...prev, ...wfForm } : prev
          );
        }
      } else {
        const { error } = await supabase.from("workflows").insert({ ...wfForm });
        if (error) throw error;
      }
      closeModal();
      await loadWorkflows();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete workflow ───────────────────────────────────────────────────

  async function deleteWorkflow(wf: WorkflowRow) {
    if (
      !confirm(
        `Delete workflow "${wf.name}"?\n\nThis will also delete all its statuses and transitions.`
      )
    )
      return;
    try {
      const { error } = await supabase
        .from("workflows")
        .delete()
        .eq("id", wf.id);
      if (error) throw error;
      await loadWorkflows();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  // ── Save status ───────────────────────────────────────────────────────

  async function saveStatus() {
    if (!statusForm.status_key.trim() || !statusForm.label.trim()) {
      setModalError("Status Key and Label are required.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      if (editingId) {
        const { error } = await supabase
          .from("workflow_statuses")
          .update(statusForm)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workflow_statuses")
          .insert({ ...statusForm });
        if (error) throw error;
      }
      closeModal();
      await loadWorkflowData(selectedWorkflow!.id);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStatus(s: WfStatus) {
    if (
      !confirm(
        `Delete status "${s.label}"?\n\nTransitions that reference this status will also be deleted.`
      )
    )
      return;
    try {
      const { error } = await supabase
        .from("workflow_statuses")
        .delete()
        .eq("id", s.id);
      if (error) throw error;
      await loadWorkflowData(selectedWorkflow!.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  // ── Save step ─────────────────────────────────────────────────────────

  async function saveStep() {
    if (!stepForm.action_label?.trim()) {
      setModalError("Action Label is required.");
      return;
    }
    setSaving(true);
    setModalError("");
    try {
      const payload: StepFormData = {
        ...stepForm,
        from_status_id: stepForm.from_status_id || null,
        to_status_id: stepForm.to_status_id || null,
        required_permission: stepForm.required_permission || null as unknown as string,
        auto_email_template: stepForm.auto_email_template || null as unknown as string,
      };
      if (editingId) {
        const { error } = await supabase
          .from("workflow_steps")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workflow_steps")
          .insert({ ...payload });
        if (error) throw error;
      }
      closeModal();
      await loadWorkflowData(selectedWorkflow!.id);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStep(s: WfStep) {
    if (!confirm("Delete this transition?")) return;
    try {
      const { error } = await supabase
        .from("workflow_steps")
        .delete()
        .eq("id", s.id);
      if (error) throw error;
      await loadWorkflowData(selectedWorkflow!.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  // ── Helper ────────────────────────────────────────────────────────────

  function statusLabel(id?: string | null) {
    if (!id) return "(any)";
    return statuses.find((s) => s.id === id)?.label ?? id.slice(0, 8) + "…";
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════
          LIST VIEW
      ════════════════════════════════════════════════════════════════ */}
      {view === "list" && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Workflows</h1>
              <p className="page-subtitle">
                Manage object lifecycle workflows, statuses, and transitions.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openAddWorkflow}>
              + Add Workflow
            </button>
          </div>

          {listError && (
            <div
              className="alert alert-error"
              style={{ marginBottom: 16 }}
            >
              {listError}
            </div>
          )}

          <div className="card">
            {loadingList ? (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                Loading workflows…
              </div>
            ) : workflows.length === 0 ? (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--text-muted)",
                }}
              >
                No workflows found. Click{" "}
                <strong>+ Add Workflow</strong> to create one.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Object Type</th>
                      <th>Status</th>
                      <th>Steps</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflows.map((wf) => (
                      <tr key={wf.id}>
                        <td>
                          <span style={{ fontWeight: 600 }}>{wf.name}</span>
                          {wf.description && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                                marginTop: 2,
                              }}
                            >
                              {wf.description}
                            </div>
                          )}
                        </td>
                        <td>
                          <code
                            style={{
                              background: "#f1f5f9",
                              padding: "2px 7px",
                              borderRadius: 4,
                              fontSize: 12,
                              color: "var(--text)",
                            }}
                          >
                            {wf.object_type}
                          </code>
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              wf.is_active ? "badge-green" : "badge-gray"
                            }`}
                          >
                            {wf.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: "var(--usps-blue)",
                            }}
                          >
                            {wf.steps_count}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => openEdit(wf)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-ghost"
                              onClick={() => openEditWorkflow(wf)}
                            >
                              Settings
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteWorkflow(wf)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          EDIT VIEW
      ════════════════════════════════════════════════════════════════ */}
      {view === "edit" && selectedWorkflow && (
        <>
          <div className="page-header">
            <div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={backToList}
                style={{ marginBottom: 8 }}
              >
                ← Back to Workflows
              </button>
              <h1 className="page-title">{selectedWorkflow.name}</h1>
              <p className="page-subtitle" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Object type:{" "}
                <code
                  style={{
                    background: "#f1f5f9",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "var(--text)",
                  }}
                >
                  {selectedWorkflow.object_type}
                </code>
                <span
                  className={`badge ${
                    selectedWorkflow.is_active ? "badge-green" : "badge-gray"
                  }`}
                >
                  {selectedWorkflow.is_active ? "Active" : "Inactive"}
                </span>
              </p>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => openEditWorkflow(selectedWorkflow)}
            >
              Edit Settings
            </button>
          </div>

          {editError && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              {editError}
            </div>
          )}

          {loadingEdit ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              Loading workflow data…
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

              {/* ── Statuses ───────────────────────────────────────────── */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Statuses</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={openAddStatus}
                  >
                    + Add Status
                  </button>
                </div>

                {statuses.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    No statuses defined. Add a status to begin building the
                    workflow lifecycle.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Status Key</th>
                          <th>Label</th>
                          <th>Initial</th>
                          <th>Terminal</th>
                          <th>Order</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statuses.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <code
                                style={{
                                  background: "#f1f5f9",
                                  padding: "2px 7px",
                                  borderRadius: 4,
                                  fontSize: 12,
                                }}
                              >
                                {s.status_key}
                              </code>
                            </td>
                            <td style={{ fontWeight: 500 }}>{s.label}</td>
                            <td>
                              {s.is_initial ? (
                                <span className="badge badge-blue">
                                  Initial
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: 12,
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td>
                              {s.is_terminal ? (
                                <span className="badge badge-gray">
                                  Terminal
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: 12,
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td style={{ color: "var(--text-muted)" }}>
                              {s.sort_order}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  className="btn btn-sm btn-outline"
                                  onClick={() => openEditStatus(s)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => deleteStatus(s)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Transitions (Steps) ────────────────────────────────── */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Transitions</span>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={openAddStep}
                  >
                    + Add Transition
                  </button>
                </div>

                {steps.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 20px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                    }}
                  >
                    No transitions defined. Add a transition to specify how
                    objects move between statuses.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>From Status</th>
                          <th>To Status</th>
                          <th>Action Label</th>
                          <th>Required Permission</th>
                          <th>Order</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {steps.map((s) => (
                          <tr key={s.id}>
                            <td>
                              <span className="badge badge-blue">
                                {statusLabel(s.from_status_id)}
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-green">
                                {statusLabel(s.to_status_id)}
                              </span>
                            </td>
                            <td style={{ fontWeight: 500 }}>
                              {s.action_label || (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontWeight: 400,
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td>
                              {s.required_permission ? (
                                <code
                                  style={{
                                    background: "#f1f5f9",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    fontSize: 11,
                                  }}
                                >
                                  {s.required_permission}
                                </code>
                              ) : (
                                <span
                                  style={{
                                    color: "var(--text-muted)",
                                    fontSize: 12,
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            <td style={{ color: "var(--text-muted)" }}>
                              {s.sort_order}
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  className="btn btn-sm btn-outline"
                                  onClick={() => openEditStep(s)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => deleteStep(s)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Add / Edit Workflow
      ════════════════════════════════════════════════════════════════ */}
      {modal === "workflow" && (
        <Modal
          title={editingId ? "Edit Workflow" : "Add Workflow"}
          onClose={closeModal}
        >
          {modalError && (
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              {modalError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Name *">
              <input
                className="form-input"
                value={wfForm.name}
                onChange={(e) =>
                  setWfForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Scorecard Review"
              />
            </Field>

            <Field
              label="Object Type *"
              hint="Lowercase identifier matching the DB table name, e.g. scorecard"
            >
              <input
                className="form-input"
                value={wfForm.object_type}
                onChange={(e) =>
                  setWfForm((f) => ({ ...f, object_type: e.target.value }))
                }
                placeholder="e.g. scorecard"
              />
            </Field>

            <Field label="Description">
              <textarea
                className="form-textarea"
                value={wfForm.description}
                onChange={(e) =>
                  setWfForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional description"
              />
            </Field>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="wf-active"
                checked={wfForm.is_active}
                onChange={(e) =>
                  setWfForm((f) => ({ ...f, is_active: e.target.checked }))
                }
              />
              <label
                htmlFor="wf-active"
                style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Active
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 22,
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
              onClick={saveWorkflow}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Add / Edit Status
      ════════════════════════════════════════════════════════════════ */}
      {modal === "status" && (
        <Modal
          title={editingId ? "Edit Status" : "Add Status"}
          onClose={closeModal}
        >
          {modalError && (
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              {modalError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field
              label="Status Key *"
              hint="Lowercase with underscores, e.g. pending_review"
            >
              <input
                className="form-input"
                value={statusForm.status_key}
                onChange={(e) =>
                  setStatusForm((f) => ({
                    ...f,
                    status_key: e.target.value,
                  }))
                }
                placeholder="e.g. pending_review"
              />
            </Field>

            <Field label="Label *">
              <input
                className="form-input"
                value={statusForm.label}
                onChange={(e) =>
                  setStatusForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="e.g. Pending Review"
              />
            </Field>

            <Field label="Description">
              <textarea
                className="form-textarea"
                value={statusForm.description}
                onChange={(e) =>
                  setStatusForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                placeholder="Optional description"
              />
            </Field>

            <div style={{ display: "flex", gap: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="s-initial"
                  checked={statusForm.is_initial}
                  onChange={(e) =>
                    setStatusForm((f) => ({
                      ...f,
                      is_initial: e.target.checked,
                    }))
                  }
                />
                <label
                  htmlFor="s-initial"
                  style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Initial Status
                </label>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="s-terminal"
                  checked={statusForm.is_terminal}
                  onChange={(e) =>
                    setStatusForm((f) => ({
                      ...f,
                      is_terminal: e.target.checked,
                    }))
                  }
                />
                <label
                  htmlFor="s-terminal"
                  style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Terminal Status
                </label>
              </div>
            </div>

            <Field label="Sort Order">
              <input
                type="number"
                className="form-input"
                min={0}
                value={statusForm.sort_order}
                onChange={(e) =>
                  setStatusForm((f) => ({
                    ...f,
                    sort_order: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 22,
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
              onClick={saveStatus}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL — Add / Edit Transition
      ════════════════════════════════════════════════════════════════ */}
      {modal === "step" && (
        <Modal
          title={editingId ? "Edit Transition" : "Add Transition"}
          onClose={closeModal}
        >
          {modalError && (
            <div className="alert alert-error" style={{ marginBottom: 14 }}>
              {modalError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="From Status">
              <select
                className="form-select"
                value={stepForm.from_status_id || ""}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    from_status_id: e.target.value || null,
                  }))
                }
              >
                <option value="">(Any / Start)</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="To Status">
              <select
                className="form-select"
                value={stepForm.to_status_id || ""}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    to_status_id: e.target.value || null,
                  }))
                }
              >
                <option value="">(None)</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Action Label *">
              <input
                className="form-input"
                value={stepForm.action_label || ""}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    action_label: e.target.value,
                  }))
                }
                placeholder="e.g. Submit for Review"
              />
            </Field>

            <Field
              label="Required Permission"
              hint="e.g. subk.co_approve — leave blank for no restriction"
            >
              <input
                className="form-input"
                value={stepForm.required_permission || ""}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    required_permission: e.target.value,
                  }))
                }
                placeholder="e.g. subk.co_approve"
              />
            </Field>

            <Field
              label="Auto Email Template"
              hint="Template key to send automatically on this transition"
            >
              <input
                className="form-input"
                value={stepForm.auto_email_template || ""}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    auto_email_template: e.target.value,
                  }))
                }
                placeholder="e.g. status_change_co_review"
              />
            </Field>

            <Field label="Sort Order">
              <input
                type="number"
                className="form-input"
                min={0}
                value={stepForm.sort_order}
                onChange={(e) =>
                  setStepForm((f) => ({
                    ...f,
                    sort_order: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 22,
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
              onClick={saveStep}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
