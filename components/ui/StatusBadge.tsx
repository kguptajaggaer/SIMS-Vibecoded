import React from "react";

type StatusKey =
  | "new_contract"
  | "open_for_reporting"
  | "ready_for_co_review"
  | "ready_for_portfolio_review"
  | "ready_for_diversity_review"
  | "close_for_report"
  | "closed"
  | "pending_next_period"
  | "data_available_export"
  | "enter_spend_data"
  | "supplier_reported"
  | "pending"
  | "enter_epp_data"
  | "ready_for_epp_admin_review"
  | "finalized"
  | "draft"
  | "active"
  | "completed"
  | "archived"
  | "setup"
  | "populated"
  | "reviewed";

type BadgeColor =
  | "badge-blue"
  | "badge-yellow"
  | "badge-orange"
  | "badge-green"
  | "badge-gray";

interface StatusConfig {
  label: string;
  color: BadgeColor;
}

const STATUS_MAP: Record<StatusKey, StatusConfig> = {
  new_contract: { label: "New Contract", color: "badge-blue" },
  open_for_reporting: { label: "Open for Reporting", color: "badge-yellow" },
  ready_for_co_review: { label: "Ready for CO Review", color: "badge-orange" },
  ready_for_portfolio_review: { label: "Ready for Portfolio Review", color: "badge-orange" },
  ready_for_diversity_review: { label: "Ready for Diversity Review", color: "badge-orange" },
  close_for_report: { label: "Close for Report", color: "badge-blue" },
  closed: { label: "Closed", color: "badge-green" },
  pending_next_period: { label: "Pending Next Period", color: "badge-gray" },
  data_available_export: { label: "Data Available for Export", color: "badge-blue" },
  enter_spend_data: { label: "Enter Spend Data", color: "badge-yellow" },
  supplier_reported: { label: "Supplier Reported", color: "badge-green" },
  pending: { label: "Pending", color: "badge-gray" },
  enter_epp_data: { label: "Enter EPP Data", color: "badge-yellow" },
  ready_for_epp_admin_review: { label: "Ready for EPP Admin Review", color: "badge-orange" },
  finalized: { label: "Finalized", color: "badge-green" },
  draft: { label: "Draft", color: "badge-gray" },
  active: { label: "Active", color: "badge-green" },
  completed: { label: "Completed", color: "badge-green" },
  archived: { label: "Archived", color: "badge-gray" },
  setup: { label: "Setup", color: "badge-blue" },
  populated: { label: "Populated", color: "badge-blue" },
  reviewed: { label: "Reviewed", color: "badge-orange" },
};

const COLOR_CLASSES: Record<BadgeColor, string> = {
  "badge-blue": "bg-blue-100 text-blue-800",
  "badge-yellow": "bg-yellow-100 text-yellow-800",
  "badge-orange": "bg-orange-100 text-orange-800",
  "badge-green": "bg-green-100 text-green-800",
  "badge-gray": "bg-gray-100 text-gray-700",
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status as StatusKey];

  const label = config ? config.label : status;
  const colorClass = config ? COLOR_CLASSES[config.color] : COLOR_CLASSES["badge-gray"];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
