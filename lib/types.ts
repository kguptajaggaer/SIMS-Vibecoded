// ─── Auth & Users ───────────────────────────────────────────────────
export type UserType = 'internal' | 'supplier'

export type RoleName =
  | 'admin'
  | 'co'
  | 'portfolio_manager'
  | 'diversity_manager'
  | 'epp_admin'
  | 'ibp_manager'
  | 'cmc_manager'
  | 'sr_manager'
  | 'ap_reviewer'

export interface Role {
  id: string
  name: string
  description?: string
  is_system_role: boolean
  created_at: string
}

export interface Permission {
  id: string
  permission_key: string
  category: string
  label: string
  description?: string
}

export interface User {
  id: string
  email: string
  name: string
  username?: string
  user_type: UserType
  role_id?: string
  role?: Role
  supplier_id?: string
  is_active: boolean
  last_login?: string
  created_at: string
  updated_at: string
}

// ─── Suppliers ──────────────────────────────────────────────────────
export type SupplierStatus =
  | 'prospective'
  | 'invited'
  | 'active'
  | 'inactive'
  | 'out_of_scope'
  | 'pending_certification'
  | 'certified'
  | 'non_certified'
  | 'expired'

export interface Supplier {
  id: string
  name: string
  apex_number?: string
  dba_name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  website?: string
  status: SupplierStatus
  is_diverse: boolean
  diversity_classifications: string[]
  groups: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export interface SupplierContact {
  id: string
  supplier_id: string
  name: string
  email?: string
  phone?: string
  title?: string
  is_primary: boolean
  created_at: string
}

// ─── Contracts ──────────────────────────────────────────────────────
export type ContractType = 'subk' | 'epp' | 'subk_epp'

export type ContractCycleStatus =
  | 'new_contract'
  | 'open_for_reporting'
  | 'ready_for_co_review'
  | 'ready_for_portfolio_review'
  | 'ready_for_diversity_review'
  | 'close_for_report'
  | 'closed'
  | 'pending_next_period'
  | 'data_available_export'

export type SupplierCycleStatus = 'pending' | 'enter_spend_data' | 'supplier_reported'

export interface Contract {
  id: string
  contract_number: string
  supplier_id?: string
  supplier_name: string
  supplier_apex?: string
  portfolios?: string
  commodity?: string
  vendor_contact?: string
  contract_amount?: number
  contract_officer: string
  contract_officer_email?: string
  start_date?: string
  expiration_date?: string
  comments?: string
  exception?: string
  contract_type: ContractType
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ContractCycle {
  id: string
  contract_id: string
  name: string
  fiscal_year?: string
  start_date?: string
  end_date?: string
  status: ContractCycleStatus
  supplier_status: SupplierCycleStatus
  goals?: string
  co_reviewed_by?: string
  co_reviewed_at?: string
  co_comments?: string
  portfolio_reviewed_by?: string
  portfolio_reviewed_at?: string
  portfolio_comments?: string
  diversity_reviewed_by?: string
  diversity_reviewed_at?: string
  diversity_comments?: string
  created_at: string
  updated_at: string
}

export interface Subcontractor {
  id: string
  contract_cycle_id: string
  vendor_name: string
  vendor_apex?: string
  classifications: string[]
  subk_units?: number
  direct_expense: number
  indirect_expense: number
  total_expense: number
  notes?: string
  created_at: string
  updated_at: string
}

// ─── EPP ────────────────────────────────────────────────────────────
export type EppStatus =
  | 'new_contract'
  | 'enter_epp_data'
  | 'open_for_reporting'
  | 'ready_for_co_review'
  | 'ready_for_epp_admin_review'
  | 'close_for_report'
  | 'closed'
  | 'pending_next_period'
  | 'finalized'

export type EppCategory =
  | 'recycled_content'
  | 'ecolabel'
  | 'biobased'
  | 'energy_efficient'
  | 'water_efficient'

export interface EppContractCycle {
  id: string
  contract_cycle_id: string
  epp_status: EppStatus
  total_contract_spend?: number
  total_epp_spend?: number
  epp_percentage?: number
  epp_categories: EppCategory[]
  instructions?: string
  supplier_instructions?: string
  co_reviewed_by?: string
  co_reviewed_at?: string
  co_comments?: string
  epp_admin_reviewed_by?: string
  epp_admin_reviewed_at?: string
  epp_admin_comments?: string
  created_at: string
  updated_at: string
}

export interface EppRecycledContent {
  id: string
  epp_contract_cycle_id: string
  product_name: string
  manufacturer?: string
  product_description?: string
  unit_of_measure?: string
  quantity_purchased?: number
  unit_price?: number
  total_spend?: number
  recovered_material_content_pct?: number
  post_consumer_content_pct?: number
  epa_designation?: string
  cpg_item?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface EppEcolabel {
  id: string
  epp_contract_cycle_id: string
  product_name: string
  manufacturer?: string
  product_description?: string
  ecolabel_name?: string
  certification_number?: string
  unit_of_measure?: string
  quantity_purchased?: number
  unit_price?: number
  total_spend?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface EppBiobased {
  id: string
  epp_contract_cycle_id: string
  product_name: string
  manufacturer?: string
  product_description?: string
  usda_designation?: string
  biobased_content_pct?: number
  unit_of_measure?: string
  quantity_purchased?: number
  unit_price?: number
  total_spend?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface EppEnergyEfficient {
  id: string
  epp_contract_cycle_id: string
  product_name: string
  manufacturer?: string
  product_description?: string
  energy_star_certified: boolean
  femp_designated: boolean
  efficiency_rating?: string
  unit_of_measure?: string
  quantity_purchased?: number
  unit_price?: number
  total_spend?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface EppWaterEfficient {
  id: string
  epp_contract_cycle_id: string
  product_name: string
  manufacturer?: string
  product_description?: string
  watersense_certified: boolean
  efficiency_rating?: string
  unit_of_measure?: string
  quantity_purchased?: number
  unit_price?: number
  total_spend?: number
  notes?: string
  created_at: string
  updated_at: string
}

// ─── Supplier Performance ────────────────────────────────────────────
export type DevelopmentPlanStatus = 'draft' | 'active' | 'completed' | 'archived'
export type SegmentationQuadrant = 'strategic' | 'critical' | 'support' | 'leading'
export type ScorecardStatus = 'setup' | 'active' | 'populated' | 'reviewed' | 'completed'
export type ReviewFrequency = 'quarterly' | 'semi_annually' | 'annually'

export interface DevelopmentPlan {
  id: string
  supplier_id: string
  name: string
  review_frequency: ReviewFrequency
  status: DevelopmentPlanStatus
  segmentation_quadrant?: SegmentationQuadrant
  strategy_guidance?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface SegmentationAssessment {
  id: string
  development_plan_id: string
  answers: Record<string, string>
  score_x?: number
  score_y?: number
  quadrant?: SegmentationQuadrant
  completed_at?: string
  created_at: string
}

export interface Scorecard {
  id: string
  development_plan_id: string
  name: string
  period_start?: string
  period_end?: string
  review_type: ReviewFrequency
  status: ScorecardStatus
  overall_score?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface ScorecardKpi {
  id: string
  scorecard_id: string
  name: string
  description?: string
  weight_pct: number
  sort_order: number
  created_at: string
}

export interface ScorecardGoal {
  id: string
  kpi_id: string
  goal_text: string
  target_value?: string
  sort_order: number
  created_at: string
}

export interface ScorecardMetric {
  id: string
  goal_id: string
  metric_name: string
  weight_pct?: number
  target?: string
  actual?: string
  score?: number
  notes?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PerformanceReview {
  id: string
  scorecard_id: string
  review_date?: string
  status: 'pending' | 'in_progress' | 'completed'
  gap_analysis?: string
  summary_action_plan?: string
  overall_comments?: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
  updated_at: string
}

export interface Concurrence {
  id: string
  object_type: 'scorecard' | 'development_plan' | 'performance_review'
  object_id: string
  step?: string
  user_id: string
  comment: string
  created_at: string
}

// ─── Admin / System ──────────────────────────────────────────────────
export interface Workflow {
  id: string
  name: string
  object_type: string
  description?: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
}

export interface EmailTemplate {
  id: string
  template_key: string
  name: string
  subject: string
  body_html: string
  body_text?: string
  variables: string[]
  is_active: boolean
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  object_type?: string
  object_id?: string
  object_label?: string
  changes?: Record<string, { old: unknown; new: unknown }>
  ip_address?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  parent_id?: string
  is_active: boolean
  sort_order: number
  created_at: string
}

// ─── Dashboard Aggregates ────────────────────────────────────────────
export interface SubkStats {
  new_contract: number
  open_for_reporting: number
  ready_for_co_review: number
  ready_for_portfolio_review: number
  ready_for_diversity_review: number
  data_available_export: number
  total_portfolio_approval: number
  close_for_report: number
  closed: number
  pending_next_period: number
}

export interface EppStats {
  new_contract: number
  open_for_reporting: number
  ready_for_co_review: number
  ready_for_epp_admin_review: number
  close_for_report: number
  closed: number
  pending_next_period: number
  finalized: number
}

export interface ScorecardTaskStats {
  development_plans: number
  scorecards: number
  performance_reviews: number
}
