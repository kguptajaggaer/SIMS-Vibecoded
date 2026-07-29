-- ===================================================================
-- SIMS – Supplier Information Management System
-- Full Database Schema for Supabase / PostgreSQL
-- Run this in the Supabase SQL editor
-- ===================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Roles & Permissions ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key VARCHAR(100) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ─── Users ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE,
  password_hash TEXT NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('internal', 'supplier')),
  role_id UUID REFERENCES roles(id),
  supplier_id UUID,                          -- FK added after suppliers table
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- ─── Suppliers ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  apex_number VARCHAR(100),
  dba_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip VARCHAR(20),
  country VARCHAR(100) DEFAULT 'USA',
  website VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('prospective','invited','active','inactive','out_of_scope',
                      'pending_certification','certified','non_certified','expired')),
  is_diverse BOOLEAN DEFAULT false,
  diversity_classifications JSONB DEFAULT '[]',
  groups JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add FK from users to suppliers
ALTER TABLE users ADD CONSTRAINT fk_users_supplier
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id);

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  title VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_extended_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
  profile_data JSONB DEFAULT '{}',
  certifications JSONB DEFAULT '[]',
  naics_codes JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_profile_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(255),
  question_text TEXT NOT NULL,
  field_type VARCHAR(50) CHECK (field_type IN ('text','select','multiselect','boolean','number','date')),
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Contracts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number VARCHAR(100) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(255) NOT NULL,
  supplier_apex VARCHAR(100),
  portfolios VARCHAR(255),
  commodity VARCHAR(255),
  vendor_contact VARCHAR(255),
  contract_amount NUMERIC(18,2),
  contract_officer VARCHAR(255) NOT NULL,
  contract_officer_email VARCHAR(255),
  start_date DATE,
  expiration_date DATE,
  comments TEXT,
  exception TEXT,
  contract_type VARCHAR(20) NOT NULL CHECK (contract_type IN ('subk','epp','subk_epp')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  fiscal_year VARCHAR(10),
  start_date DATE,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'new_contract'
    CHECK (status IN ('new_contract','open_for_reporting','ready_for_co_review',
                      'ready_for_portfolio_review','ready_for_diversity_review',
                      'close_for_report','closed','pending_next_period','data_available_export')),
  supplier_status VARCHAR(50) DEFAULT 'pending'
    CHECK (supplier_status IN ('pending','enter_spend_data','supplier_reported')),
  goals TEXT,
  co_reviewed_by UUID REFERENCES users(id),
  co_reviewed_at TIMESTAMPTZ,
  co_comments TEXT,
  portfolio_reviewed_by UUID REFERENCES users(id),
  portfolio_reviewed_at TIMESTAMPTZ,
  portfolio_comments TEXT,
  diversity_reviewed_by UUID REFERENCES users(id),
  diversity_reviewed_at TIMESTAMPTZ,
  diversity_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_cycle_id UUID REFERENCES contract_cycles(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_apex VARCHAR(100),
  classifications JSONB DEFAULT '[]',
  subk_units INTEGER,
  direct_expense NUMERIC(18,2) DEFAULT 0,
  indirect_expense NUMERIC(18,2) DEFAULT 0,
  total_expense NUMERIC(18,2) GENERATED ALWAYS AS (direct_expense + indirect_expense) STORED,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subk_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID REFERENCES users(id),
  file_name VARCHAR(255),
  records_total INTEGER,
  records_success INTEGER,
  records_failed INTEGER,
  errors JSONB DEFAULT '[]',
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- ─── EPP ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS epp_contract_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_cycle_id UUID UNIQUE REFERENCES contract_cycles(id) ON DELETE CASCADE,
  epp_status VARCHAR(50) DEFAULT 'new_contract'
    CHECK (epp_status IN ('new_contract','enter_epp_data','open_for_reporting',
                          'ready_for_co_review','ready_for_epp_admin_review',
                          'close_for_report','closed','pending_next_period','finalized')),
  total_contract_spend NUMERIC(18,2),
  total_epp_spend NUMERIC(18,2),
  epp_percentage NUMERIC(8,4),
  epp_categories JSONB DEFAULT '[]',
  instructions TEXT,
  supplier_instructions TEXT,
  co_reviewed_by UUID REFERENCES users(id),
  co_reviewed_at TIMESTAMPTZ,
  co_comments TEXT,
  epp_admin_reviewed_by UUID REFERENCES users(id),
  epp_admin_reviewed_at TIMESTAMPTZ,
  epp_admin_comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_recycled_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_description TEXT,
  unit_of_measure VARCHAR(100),
  quantity_purchased NUMERIC(18,4),
  unit_price NUMERIC(18,4),
  total_spend NUMERIC(18,2),
  recovered_material_content_pct NUMERIC(8,4),
  post_consumer_content_pct NUMERIC(8,4),
  epa_designation VARCHAR(255),
  cpg_item VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_ecolabel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_description TEXT,
  ecolabel_name VARCHAR(255),
  certification_number VARCHAR(255),
  unit_of_measure VARCHAR(100),
  quantity_purchased NUMERIC(18,4),
  unit_price NUMERIC(18,4),
  total_spend NUMERIC(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_biobased (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_description TEXT,
  usda_designation VARCHAR(255),
  biobased_content_pct NUMERIC(8,4),
  unit_of_measure VARCHAR(100),
  quantity_purchased NUMERIC(18,4),
  unit_price NUMERIC(18,4),
  total_spend NUMERIC(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_energy_efficient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_description TEXT,
  energy_star_certified BOOLEAN DEFAULT false,
  femp_designated BOOLEAN DEFAULT false,
  efficiency_rating VARCHAR(255),
  unit_of_measure VARCHAR(100),
  quantity_purchased NUMERIC(18,4),
  unit_price NUMERIC(18,4),
  total_spend NUMERIC(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_water_efficient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  manufacturer VARCHAR(255),
  product_description TEXT,
  watersense_certified BOOLEAN DEFAULT false,
  efficiency_rating VARCHAR(255),
  unit_of_measure VARCHAR(100),
  quantity_purchased NUMERIC(18,4),
  unit_price NUMERIC(18,4),
  total_spend NUMERIC(18,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS epp_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epp_contract_cycle_id UUID REFERENCES epp_contract_cycles(id),
  imported_by UUID REFERENCES users(id),
  file_name VARCHAR(255),
  records_total INTEGER,
  records_success INTEGER,
  records_failed INTEGER,
  errors JSONB DEFAULT '[]',
  imported_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Supplier Performance ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS development_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  review_frequency VARCHAR(20) CHECK (review_frequency IN ('quarterly','semi_annually','annually')),
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft','active','completed','archived')),
  segmentation_quadrant VARCHAR(50)
    CHECK (segmentation_quadrant IN ('strategic','critical','support','leading')),
  strategy_guidance TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segmentation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  axis VARCHAR(10) CHECK (axis IN ('x','y')),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  options JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS segmentation_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_plan_id UUID UNIQUE REFERENCES development_plans(id) ON DELETE CASCADE,
  answers JSONB DEFAULT '{}',
  score_x NUMERIC(8,4),
  score_y NUMERIC(8,4),
  quadrant VARCHAR(50),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  development_plan_id UUID REFERENCES development_plans(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  period_start DATE,
  period_end DATE,
  review_type VARCHAR(20) CHECK (review_type IN ('quarterly','semi_annually','annually')),
  status VARCHAR(50) DEFAULT 'setup'
    CHECK (status IN ('setup','active','populated','reviewed','completed')),
  overall_score NUMERIC(8,4),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scorecard_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID REFERENCES scorecards(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  weight_pct NUMERIC(8,4) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scorecard_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES scorecard_kpis(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL,
  target_value VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scorecard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES scorecard_goals(id) ON DELETE CASCADE,
  metric_name VARCHAR(255) NOT NULL,
  weight_pct NUMERIC(8,4),
  target VARCHAR(255),
  actual VARCHAR(255),
  score NUMERIC(8,4),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS metric_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255),
  description TEXT,
  default_target VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID REFERENCES scorecards(id) ON DELETE CASCADE,
  review_date DATE,
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','completed')),
  gap_analysis TEXT,
  summary_action_plan TEXT,
  overall_comments TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type VARCHAR(50) NOT NULL
    CHECK (object_type IN ('scorecard','development_plan','performance_review')),
  object_id UUID NOT NULL,
  step VARCHAR(50),
  user_id UUID REFERENCES users(id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Admin & System ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value TEXT,
  setting_type VARCHAR(50) DEFAULT 'string',
  category VARCHAR(100),
  label VARCHAR(255),
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS menu_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(255) NOT NULL,
  url VARCHAR(500),
  parent_key VARCHAR(100),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  required_permission VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  object_type VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  description TEXT,
  is_initial BOOLEAN DEFAULT false,
  is_terminal BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  from_status_id UUID REFERENCES workflow_statuses(id),
  to_status_id UUID REFERENCES workflow_statuses(id),
  action_label VARCHAR(255),
  required_permission VARCHAR(100),
  conditions JSONB DEFAULT '{}',
  auto_email_template VARCHAR(100),
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_user_id UUID REFERENCES users(id),
  subject TEXT,
  body_html TEXT,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent','failed','pending')),
  error_message TEXT,
  related_object_type VARCHAR(100),
  related_object_id UUID,
  sent_by UUID REFERENCES users(id),
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  object_type VARCHAR(100),
  object_id UUID,
  object_label VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  content TEXT,
  page_type VARCHAR(50) CHECK (page_type IN ('internal','user_guide','policy','help')),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Grant permissions to anon role ─────────────────────────────────
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ─── Seed Data ───────────────────────────────────────────────────────

-- Insert system roles
INSERT INTO roles (name, description, is_system_role) VALUES
  ('admin', 'Full system access', true),
  ('co', 'Contracting Officer', true),
  ('portfolio_manager', 'Portfolio-level approvals and scorecards', true),
  ('diversity_manager', 'Diversity review and approval', true),
  ('epp_admin', 'EPP contract review and final approval', true),
  ('ibp_manager', 'IBP scorecard task list', true),
  ('cmc_manager', 'CMC scorecard task list', true),
  ('sr_manager', 'SR scorecard task list', true),
  ('ap_reviewer', 'Read-only audit/reporting access', true)
ON CONFLICT (name) DO NOTHING;

-- Insert all permission keys
INSERT INTO permissions (permission_key, category, label) VALUES
  ('content.manage_external', 'Content', 'Manage External Content'),
  ('delete.scorecard', 'Delete Permissions', 'Delete Scorecard'),
  ('email.batch_internal', 'Email', 'Batch Email Internal Users'),
  ('email.batch_prospective', 'Email', 'Batch Email Prospective Suppliers'),
  ('email.batch_suppliers', 'Email', 'Batch Email Suppliers'),
  ('email.manage_automated', 'Email', 'Manage Automated Batch Emails'),
  ('email.manage_templates', 'Email', 'Manage Batch Email Templates'),
  ('email.manage_system', 'Email', 'Manage System Emails'),
  ('email.view_history', 'Email', 'View Email History'),
  ('reports.performance', 'Global Reports', 'Performance Reports'),
  ('reports.view_audit_log', 'Reports', 'View Audit Log Reports'),
  ('reports.view_email', 'Reports', 'View Email Reports'),
  ('reports.view_internal_user_log', 'Reports', 'View Internal User Log Reports'),
  ('subk.co_approve', 'SubK Compliance', 'CO Approve'),
  ('subk.contract_import', 'SubK Compliance', 'Contract Import'),
  ('subk.delete', 'SubK Compliance', 'Delete SubK'),
  ('subk.diversity_approve', 'SubK Compliance', 'Diversity Approve'),
  ('subk.edit_data', 'SubK Compliance', 'Edit SubK Data'),
  ('subk.epp_admin_approve', 'SubK Compliance', 'EPP Admin Approve'),
  ('subk.epp_contract_management', 'SubK Compliance', 'EPP Contract Management'),
  ('subk.epp_contract_setup', 'SubK Compliance', 'EPP Contract Setup'),
  ('subk.epp_reports', 'SubK Compliance', 'EPP Reports'),
  ('subk.import_edit_spend', 'SubK Compliance', 'Import / Edit SubK Spend Data'),
  ('subk.portfolio_approve', 'SubK Compliance', 'Portfolio Approve'),
  ('subk.contract_management', 'SubK Compliance', 'SubK Contract Management'),
  ('subk.contract_setup', 'SubK Compliance', 'SubK Contract Setup'),
  ('subk.reports', 'SubK Compliance', 'SubK Reports'),
  ('supplier.list_access', 'Supplier List', 'Supplier List Access'),
  ('supplier.add', 'Supplier Management', 'Add Supplier'),
  ('supplier.add_contact', 'Supplier Management', 'Add Supplier Contact'),
  ('supplier.audit_log_review', 'Supplier Management', 'AuditLog Review'),
  ('supplier.delete', 'Supplier Management', 'Delete Supplier'),
  ('supplier.delete_contact', 'Supplier Management', 'Delete Supplier Contact'),
  ('supplier.import', 'Supplier Management', 'Import Suppliers'),
  ('supplier.initiate_registration', 'Supplier Management', 'Initiate Supplier Registration'),
  ('supplier.manage_groups', 'Supplier Management', 'Manage Supplier Groups'),
  ('supplier.modify_apex', 'Supplier Management', 'Modify APEX Number'),
  ('supplier.modify_info', 'Supplier Management', 'Modify Supplier Information'),
  ('supplier.modify_password', 'Supplier Management', 'Modify Supplier Password'),
  ('supplier.search', 'Supplier Management', 'Search Suppliers'),
  ('perf.delete_action', 'Supplier Performance', 'Delete Action'),
  ('perf.manage_metric_library', 'Supplier Performance', 'Manage Metric Library'),
  ('perf.manage', 'Supplier Performance', 'Manage Supplier Performance'),
  ('perf.reports', 'Supplier Performance', 'Supplier Performance Reports'),
  ('perf.view', 'Supplier Performance', 'View Supplier Performance'),
  ('system.default_page', 'System', 'Default Page / View Outlook Page'),
  ('system.delegate', 'System', 'Delegate'),
  ('system.manage_categories', 'System', 'Manage Categories'),
  ('system.manage_internal_pages', 'System', 'Manage Internal Pages'),
  ('system.manage_internal_user_registration', 'System', 'Manage Internal User Registration'),
  ('system.manage_permissions', 'System', 'Manage Permissions'),
  ('system.manage_settings', 'System', 'Manage System Settings'),
  ('system.manage_user_accounts', 'System', 'Manage User Accounts'),
  ('system.manage_user_roles', 'System', 'Manage User Roles'),
  ('system.manage_workflows', 'System', 'Manage Workflows'),
  ('view.approved_suppliers', 'Supplier View', 'View Approved Suppliers'),
  ('view.current_suppliers', 'Supplier View', 'View Current Suppliers'),
  ('view.expired_suppliers', 'Supplier View', 'View Expired Suppliers'),
  ('view.inactive_suppliers', 'Supplier View', 'View Inactive Suppliers'),
  ('view.prospective_suppliers', 'Supplier View', 'View Prospective Suppliers'),
  ('workflow.control', 'Workflow', 'Workflow Control')
ON CONFLICT (permission_key) DO NOTHING;

-- Grant all permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Seed default admin user (password: Admin@123 — change immediately)
-- password_hash is bcrypt of 'Admin@123' — replace with real hash in production
INSERT INTO users (email, name, username, password_hash, user_type, role_id, is_active)
SELECT 'admin@usps.gov', 'SIMS Administrator', 'admin', '$2a$10$rRjgpXPpLlKhEiP3.7IqkuSiZ0yUmijKiCE9XSgY3lmBiUSr9qMqu', 'internal', r.id, true
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;

-- Default segmentation questions
INSERT INTO segmentation_questions (question_text, axis, sort_order, options) VALUES
  ('What is the annual spend with this supplier?', 'x', 1, '[{"label":"< $100K","value":"low","points":1},{"label":"$100K - $1M","value":"medium","points":2},{"label":"$1M - $10M","value":"high","points":3},{"label":"> $10M","value":"critical","points":4}]'),
  ('How many alternative suppliers exist?', 'x', 2, '[{"label":"Many (5+)","value":"many","points":1},{"label":"A few (2-4)","value":"few","points":2},{"label":"One alternative","value":"one","points":3},{"label":"No alternatives","value":"none","points":4}]'),
  ('What is the strategic importance of this supplier?', 'x', 3, '[{"label":"Low","value":"low","points":1},{"label":"Medium","value":"medium","points":2},{"label":"High","value":"high","points":3},{"label":"Critical","value":"critical","points":4}]'),
  ('How would you rate the supplier''s financial stability?', 'y', 1, '[{"label":"Poor","value":"poor","points":1},{"label":"Fair","value":"fair","points":2},{"label":"Good","value":"good","points":3},{"label":"Excellent","value":"excellent","points":4}]'),
  ('How would you rate the supplier''s operational performance?', 'y', 2, '[{"label":"Needs Improvement","value":"poor","points":1},{"label":"Average","value":"fair","points":2},{"label":"Good","value":"good","points":3},{"label":"Excellent","value":"excellent","points":4}]'),
  ('What is the supplier''s compliance track record?', 'y', 3, '[{"label":"Multiple violations","value":"poor","points":1},{"label":"Occasional issues","value":"fair","points":2},{"label":"Generally compliant","value":"good","points":3},{"label":"Fully compliant","value":"excellent","points":4}]')
ON CONFLICT DO NOTHING;
