export interface SqlSection {
  id: string;
  phase: 1 | 2 | 3 | 4 | 5;
  shortLabel: string;
  titleAr: string;
  subtitleAr: string;
  code: string;
  explanationPoints: {
    label: string;
    detail: string;
  }[];
}

export const SQL_SECTIONS: SqlSection[] = [
  // ==========================================================================
  // PHASE 1: الحسابات والمخازن
  // ==========================================================================
  {
    id: 'enums',
    phase: 1,
    shortLabel: 'ENUMs',
    titleAr: '1. الإعداد والأنواع المخصصة (ENUMs)',
    subtitleAr: 'تفعيل UUID وإنشاء قوائم القيم الثابتة لضمان سلامة البيانات المحاسبية والمخزنية',
    code: `-- ============================================================================
-- نظام الحسابات والمخازن السحابي (Cloud ERP) - قاعدة بيانات PostgreSQL / Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE account_type_enum AS ENUM (
  'asset',      -- الأصول
  'liability',  -- الخصوم (الالتزامات)
  'equity',     -- حقوق الملكية
  'revenue',    -- الإيرادات
  'expense'     -- المصروفات
);

CREATE TYPE balance_side_enum AS ENUM ('debit', 'credit');
CREATE TYPE item_type_enum AS ENUM ('stock', 'service');

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
    explanationPoints: [
      {
        label: 'استخدام UUID بدلاً من الأرقام المتسلسلة',
        detail: 'يحمي المعرفات من التخمين في البيئات السحابية ويسهّل الدمج أو المزامنة بين الفروع.',
      },
      {
        label: 'أنواع ENUM الصارمة',
        detail: 'تمنع إدخال نوع حساب غير صالح في شجرة الحسابات وتقتصر القيم على التصنيفات المحاسبية الخمسة.',
      },
    ],
  },
  {
    id: 'chart_of_accounts',
    phase: 1,
    shortLabel: 'شجرة الحسابات',
    titleAr: '2. جدول شجرة الحسابات الهرمية (chart_of_accounts)',
    subtitleAr: 'يدعم الهيكل الشجري متعدد المستويات عبر علاقة ربط ذاتية (Self-Referencing FK)',
    code: `-- ============================================================================
-- جدول شجرة الحسابات الهرمية (Chart of Accounts)
-- ============================================================================
CREATE TABLE chart_of_accounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(30) NOT NULL UNIQUE,
  name_ar        VARCHAR(150) NOT NULL,
  name_en        VARCHAR(150),
  account_type   account_type_enum NOT NULL,
  normal_balance balance_side_enum NOT NULL,
  parent_id      UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  level          SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  is_postable    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_coa_no_self_parent CHECK (parent_id IS DISTINCT FROM id)
);

CREATE INDEX idx_coa_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);

CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'العلاقة الهرمية (parent_id)',
        detail: 'يرتبط الحساب الفرعي بالحساب الأب داخل نفس الجدول، وتكون القيمة NULL للحسابات الخمسة الرئيسية.',
      },
      {
        label: 'حماية الشجرة (ON DELETE RESTRICT)',
        detail: 'يمنع حذف أي حساب رئيسي طالما توجد حسابات فرعية أو مستودعات أو أطراف مرتبطة به.',
      },
    ],
  },
  {
    id: 'warehouses',
    phase: 1,
    shortLabel: 'المستودعات',
    titleAr: '3. جدول المستودعات (warehouses)',
    subtitleAr: 'إدارة الفروع والمخازن مع ربط كل مستودع بحسابه المالي في شجرة الحسابات',
    code: `-- ============================================================================
-- جدول المستودعات (Warehouses)
-- ============================================================================
CREATE TABLE warehouses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(20) NOT NULL UNIQUE,
  name_ar              VARCHAR(120) NOT NULL,
  name_en              VARCHAR(120),
  location             TEXT,
  manager_name         VARCHAR(100),
  phone                VARCHAR(30),
  inventory_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  is_default           BOOLEAN NOT NULL DEFAULT FALSE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warehouses_account ON warehouses(inventory_account_id);

CREATE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'الربط المحاسبي المباشر (inventory_account_id)',
        detail: 'كل مستودع يرتبط بحساب أصول مخزنية في شجرة الحسابات لتوجيه قيود التوريد والصرف آلياً.',
      },
    ],
  },
  {
    id: 'units',
    phase: 1,
    shortLabel: 'الوحدات',
    titleAr: '4. جدول الوحدات ومعامل التحويل (units)',
    subtitleAr: 'تعريف الوحدات الأساسية والفرعية مع معامل تحويل دقيق للوحدة الأساسية',
    code: `-- ============================================================================
-- جدول الوحدات ومعامل التحويل (Units & Conversion Factors)
-- ============================================================================
CREATE TABLE units (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(20) NOT NULL UNIQUE,
  name_ar           VARCHAR(60) NOT NULL,
  name_en           VARCHAR(60),
  symbol            VARCHAR(15) NOT NULL,
  base_unit_id      UUID REFERENCES units(id) ON DELETE RESTRICT,
  conversion_factor NUMERIC(18, 6) NOT NULL DEFAULT 1.000000 CHECK (conversion_factor > 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_units_base_logic CHECK (
    (base_unit_id IS NULL AND conversion_factor = 1)
    OR
    (base_unit_id IS NOT NULL AND base_unit_id <> id)
  )
);

CREATE INDEX idx_units_base_unit ON units(base_unit_id);

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'دقة الكسور العشرية NUMERIC(18, 6)',
        detail: 'يمنع أخطاء التقريب عند التحويل بين الوحدات الصغيرة والكبيرة.',
      },
    ],
  },
  {
    id: 'items',
    phase: 1,
    shortLabel: 'الأصناف',
    titleAr: '5. جدول الأصناف والباركود والتكلفة (items)',
    subtitleAr: 'بطاقة الصنف الكاملة المرتبطة بالوحدات والمستودع الافتراضي وحسابات الأستاذ العام',
    code: `-- ============================================================================
-- جدول الأصناف (Items) مع الباركود والتكلفة والربط الكامل
-- ============================================================================
CREATE TABLE items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                  VARCHAR(50) NOT NULL UNIQUE,
  barcode              VARCHAR(64) UNIQUE,
  name_ar              VARCHAR(200) NOT NULL,
  name_en              VARCHAR(200),
  item_type            item_type_enum NOT NULL DEFAULT 'stock',
  base_unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  purchase_unit_id     UUID REFERENCES units(id) ON DELETE RESTRICT,
  default_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  cost_price           NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  selling_price        NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  min_stock_level      NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
  inventory_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  cogs_account_id      UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  revenue_account_id   UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_barcode ON items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_items_base_unit ON items(base_unit_id);
CREATE INDEX idx_items_warehouse ON items(default_warehouse_id);

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'التكامل المحاسبي الثلاثي',
        detail: 'ربط الصنف بحساب المخزون، تكلفة المبيعات، وإيرادات المبيعات لتوليد القيود آلياً.',
      },
    ],
  },

  // ==========================================================================
  // PHASE 2: الأطراف والموارد البشرية والشركاء والصلاحيات
  // ==========================================================================
  {
    id: 'customers_suppliers',
    phase: 2,
    shortLabel: 'العملاء والموردين',
    titleAr: '6. جدول العملاء والحد الائتماني + جدول الموردين (customers, suppliers)',
    subtitleAr: 'تصنيف زوايا العملاء والرقابة على الحد الائتماني وربط الذمم المدينة والدائنة بالشجرة المحاسبية',
    code: `-- ============================================================================
-- المرحلة 2: الأطراف والموارد البشرية والشركاء والصلاحيات
-- ============================================================================

CREATE TYPE customer_tier_enum AS ENUM ('retail', 'wholesale', 'corporate', 'vip');

-- جدول العملاء والحد الائتماني
CREATE TABLE customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  VARCHAR(30) NOT NULL UNIQUE,
  name_ar               VARCHAR(150) NOT NULL,
  name_en               VARCHAR(150),
  customer_tier         customer_tier_enum NOT NULL DEFAULT 'retail',
  tax_number            VARCHAR(30),
  commercial_reg        VARCHAR(40),
  phone                 VARCHAR(30),
  email                 VARCHAR(120),
  city                  VARCHAR(80),
  address               TEXT,
  -- الحد الائتماني وأيام السداد الآجل
  credit_limit          NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  current_balance       NUMERIC(18, 4) NOT NULL DEFAULT 0,
  payment_terms_days    SMALLINT NOT NULL DEFAULT 0 CHECK (payment_terms_days >= 0),
  -- الربط مع حساب ذمم العملاء والمستودع الافتراضي
  receivable_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  default_warehouse_id  UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_tier ON customers(customer_tier);
CREATE INDEX idx_customers_receivable_acc ON customers(receivable_account_id);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- جدول الموردين
CREATE TABLE suppliers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               VARCHAR(30) NOT NULL UNIQUE,
  name_ar            VARCHAR(150) NOT NULL,
  name_en            VARCHAR(150),
  tax_number         VARCHAR(30),
  commercial_reg     VARCHAR(40),
  contact_person     VARCHAR(100),
  phone              VARCHAR(30),
  email              VARCHAR(120),
  city               VARCHAR(80),
  address            TEXT,
  payment_terms_days SMALLINT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  current_balance    NUMERIC(18, 4) NOT NULL DEFAULT 0,
  -- الربط مع حساب الموردين الدائنين في شجرة الحسابات
  payable_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_payable_acc ON suppliers(payable_account_id);

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'زوايا العملاء (customer_tier)',
        detail: 'تصنف العملاء إلى (تجزئة، جملة، شركات، VIP) لتطبيق سياسات تسعير وائتمان مختلفة لكل فئة.',
      },
      {
        label: 'الرقابة الائتمانية (credit_limit & current_balance)',
        detail: 'تمنع تجاوز سقف المبيعات الآجلة للعميل بمقارنة الرصيد الحالي + الفاتورة الجديدة مع الحد الائتماني.',
      },
      {
        label: 'ربط الذمم بالشجرة (receivable / payable_account_id)',
        detail: 'يوجه فواتير المبيعات الآجلة لحسابات المدينين، وفواتير المشتريات لحسابات الدائنين تلقائياً.',
      },
    ],
  },
  {
    id: 'employees',
    phase: 2,
    shortLabel: 'الموظفين',
    titleAr: '7. جدول الموظفين (employees)',
    subtitleAr: 'إدارة الكوادر الوظيفية والرواتب والبدلات مع ربطها بالمستودع وحسابات الرواتب والسلف',
    code: `-- ============================================================================
-- جدول الموظفين (Employees)
-- ============================================================================
CREATE TYPE employment_status_enum AS ENUM ('active', 'on_leave', 'terminated');

CREATE TABLE employees (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code             VARCHAR(30) NOT NULL UNIQUE,
  full_name_ar              VARCHAR(150) NOT NULL,
  full_name_en              VARCHAR(150),
  national_id               VARCHAR(30) UNIQUE,
  department                VARCHAR(100) NOT NULL,
  job_title                 VARCHAR(100) NOT NULL,
  hire_date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  phone                     VARCHAR(30),
  email                     VARCHAR(120),
  basic_salary              NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  housing_allowance         NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (housing_allowance >= 0),
  transport_allowance       NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (transport_allowance >= 0),
  -- ربط الموظف بالفرع/المستودع وبحسابات الرواتب والسلف
  warehouse_id              UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  salary_expense_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  advance_account_id        UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  employment_status         employment_status_enum NOT NULL DEFAULT 'active',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_warehouse ON employees(warehouse_id);
CREATE INDEX idx_employees_status ON employees(employment_status);

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`,
    explanationPoints: [
      {
        label: 'تفصيل الراتب والبدلات',
        detail: 'فصل الراتب الأساسي عن بدلات السكن والنقل يسهّل احتساب مستحقات نهاية الخدمة والإجازات.',
      },
      {
        label: 'الربط المزدوج بالمستودع والحسابات',
        detail: 'يربط الموظف بفرع/مستودع عمله وبحساب مصروف الرواتب وحساب سلف وعهد الموظفين.',
      },
    ],
  },
  {
    id: 'partners',
    phase: 2,
    shortLabel: 'الشركاء وجاريهم',
    titleAr: '8. جدول الشركاء وجاري الشركاء (partners, partner_current_accounts)',
    subtitleAr: 'إدارة حصص الملكية ورأس المال وسجل حركات المسحوبات والأرباح والإيداعات',
    code: `-- ============================================================================
-- جدول الشركاء (Partners)
-- ============================================================================
CREATE TABLE partners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 VARCHAR(30) NOT NULL UNIQUE,
  name_ar              VARCHAR(150) NOT NULL,
  name_en              VARCHAR(150),
  national_id          VARCHAR(30) UNIQUE,
  phone                VARCHAR(30),
  ownership_percent    NUMERIC(5, 2) NOT NULL CHECK (ownership_percent > 0 AND ownership_percent <= 100),
  capital_contribution NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (capital_contribution >= 0),
  -- ربط الشريك بحساب رأس المال وحساب جاري الشريك في شجرة الحسابات
  capital_account_id   UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  current_account_id   UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- جدول حركات جاري الشركاء (Partner Current Accounts Ledger)
-- ============================================================================
CREATE TYPE partner_tx_type_enum AS ENUM (
  'capital_injection', -- ضخ / زيادة رأس مال
  'drawing',           -- مسحوبات شخصية للشريك (مدين)
  'profit_share',      -- توزيع حصة أرباح (دائن)
  'loss_share',        -- تحميل حصة خسارة (مدين)
  'loan_to_company'    -- تمويل / قرض من الشريك للشركة (دائن)
);

CREATE TABLE partner_current_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type partner_tx_type_enum NOT NULL,
  -- debit = مسحوبات أو خسائر على الشريك | credit = أرباح أو إيداعات لصالح الشريك
  direction        balance_side_enum NOT NULL,
  amount           NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  reference_no     VARCHAR(50),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_partner_tx_partner ON partner_current_accounts(partner_id);
CREATE INDEX idx_partner_tx_date ON partner_current_accounts(transaction_date);`,
    explanationPoints: [
      {
        label: 'فصل رأس المال عن الجاري (partners vs partner_current_accounts)',
        detail: 'رأس المال ثابت نسبياً في جدول الشركاء، بينما تُسجّل المسحوبات والأرباح الدورية كحركات دفترية مؤرخة في جدول جاري الشركاء.',
      },
      {
        label: 'تحديد اتجاه الحركة (direction: debit / credit)',
        detail: 'يسمح باحتساب صافي رصيد جاري كل شريك لحظياً بطرح إجمالي المدين (المسحوبات) من إجمالي الدائن (الأرباح والإيداعات).',
      },
    ],
  },
  {
    id: 'users_roles',
    phase: 2,
    shortLabel: 'المستخدمين والصلاحيات',
    titleAr: '9. جدول المستخدمين والأدوار والصلاحيات (roles, role_permissions, app_users)',
    subtitleAr: 'نظام صلاحيات RBAC دقيق يحدد حق العرض والإنشاء والتعديل والحذف والاعتماد لكل موديول',
    code: `-- ============================================================================
-- جداول الأدوار والصلاحيات والمستخدمين (RBAC - Users & Roles)
-- ============================================================================
CREATE TYPE erp_module_enum AS ENUM (
  'accounts',
  'warehouses',
  'items',
  'customers',
  'suppliers',
  'employees',
  'partners',
  'sales',
  'purchases',
  'users_roles'
);

CREATE TABLE roles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(40) NOT NULL UNIQUE,
  name_ar        VARCHAR(100) NOT NULL,
  name_en        VARCHAR(100),
  description    TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- مصفوفة الصلاحيات التفصيلية لكل دور ولكل موديول
CREATE TABLE role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module_key  erp_module_enum NOT NULL,
  can_view    BOOLEAN NOT NULL DEFAULT FALSE,
  can_create  BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete  BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role_id, module_key)
);

CREATE INDEX idx_role_perms_role ON role_permissions(role_id);

-- جدول مستخدمي النظام المرتبط بـ Supabase Auth والأدوار والموظفين
CREATE TABLE app_users (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- يرتبط بمعرف المستخدم في Supabase Auth (auth.users) عند التفعيل
  auth_user_id         UUID UNIQUE,
  username             VARCHAR(60) NOT NULL UNIQUE,
  full_name            VARCHAR(150) NOT NULL,
  email                VARCHAR(150) NOT NULL UNIQUE,
  role_id              UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  employee_id          UUID UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
  default_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_users_role ON app_users(role_id);

CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON app_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ربط منشئ حركة جاري الشريك بجدول المستخدمين
ALTER TABLE partner_current_accounts
  ADD COLUMN created_by UUID REFERENCES app_users(id) ON DELETE SET NULL;`,
    explanationPoints: [
      {
        label: 'مصفوفة الصلاحيات (role_permissions)',
        detail: 'قيد UNIQUE (role_id, module_key) يضمن سطراً واحداً لكل موديول داخل كل دور وظيفي مع 5 أذونات (عرض، إنشاء، تعديل، حذف، اعتماد).',
      },
      {
        label: 'التكامل مع Supabase Auth والموظفين',
        detail: 'جدول app_users يربط حساب الدخول السحابي (auth_user_id) بسجل الموظف (employee_id) وبالدور الوظيفي (role_id) والمستودع الافتراضي.',
      },
      {
        label: 'تتبع المدقق (created_by)',
        detail: 'ربط حركات جاري الشركاء بالمستخدم الذي أنشأ الحركة لتدقيق العمليات المالية الحساسة.',
      },
    ],
  },
  {
    id: 'seed_rls',
    phase: 2,
    shortLabel: 'RLS والبيانات',
    titleAr: '10. تفعيل أمان الصفوف (RLS) وبيانات الإدخال التأسيسية',
    subtitleAr: 'حماية جميع جداول المرحلتين في Supabase وإدخال حسابات ومستخدمين وصلاحيات تجريبية',
    code: `-- ============================================================================
-- تفعيل حماية الصفوف (Row Level Security) لجميع الجداول
-- ============================================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_current_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- بيانات تأسيسية مختصرة للمرحلة الثانية (تُنفّذ بعد إدخال الشجرة والمستودعات)
-- ============================================================================
INSERT INTO roles (code, name_ar, name_en, is_system_role) VALUES
  ('super_admin', 'مدير النظام العام', 'System Administrator', TRUE),
  ('chief_accountant', 'رئيس الحسابات', 'Chief Accountant', FALSE),
  ('warehouse_keeper', 'أمين المستودع', 'Warehouse Keeper', FALSE);

-- منح مدير النظام جميع الصلاحيات على كل الموديولات
INSERT INTO role_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete, can_approve)
SELECT r.id, m.module_key, TRUE, TRUE, TRUE, TRUE, TRUE
FROM roles r
CROSS JOIN (
  SELECT UNNEST(ENUM_RANGE(NULL::erp_module_enum)) AS module_key
) m
WHERE r.code = 'super_admin';`,
    explanationPoints: [
      {
        label: 'توليد مصفوفة الصلاحيات تلقائياً (ENUM_RANGE)',
        detail: 'يستخدم استعلاماً ذكياً لإنشاء صلاحيات كل الموديولات لدور مدير النظام في أمر واحد دون تكرار.',
      },
    ],
  },

  // ==========================================================================
  // PHASE 3: العمليات المالية والسندات وقيود اليومية العامة
  // ==========================================================================
  {
    id: 'journal_entries',
    phase: 3,
    shortLabel: 'قيود اليومية والتحديث التلقائي',
    titleAr: '11. قيود اليومية العامة وتحديث شجرة الحسابات تلقائياً (journal_entries & Triggers)',
    subtitleAr: 'فرض توازن القيد المزدوج (المدين = الدائن) وتحديث أرصدة الحسابات الفرعية والأب هرمياً عند أي ترحيل',
    code: `-- ============================================================================
-- المرحلة 3: قيود اليومية العامة وتحديث أرصدة شجرة الحسابات تلقائياً
-- ============================================================================

-- إضافة حقل الرصيد الحالي إلى شجرة الحسابات لتخزين الرصيد التجميعي والفرعي
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS current_balance NUMERIC(18, 4) NOT NULL DEFAULT 0;

CREATE TYPE journal_source_enum AS ENUM (
  'manual', 'receipt_voucher', 'payment_voucher', 'operating_expense', 'operating_revenue'
);
CREATE TYPE journal_status_enum AS ENUM ('draft', 'posted', 'reversed');

CREATE TABLE journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_no      VARCHAR(30) NOT NULL UNIQUE,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type   journal_source_enum NOT NULL DEFAULT 'manual',
  source_ref_no VARCHAR(40),
  description   TEXT NOT NULL,
  total_debit   NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (total_debit >= 0),
  total_credit  NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
  status        journal_status_enum NOT NULL DEFAULT 'posted',
  created_by    UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_je_date ON journal_entries(entry_date);
CREATE INDEX idx_je_source ON journal_entries(source_type, source_ref_no);

CREATE TRIGGER trg_je_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE journal_entry_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit            NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit           NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  line_memo        TEXT,
  warehouse_id     UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  CONSTRAINT chk_je_line_side CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX idx_jel_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account ON journal_entry_lines(account_id);

-- ----------------------------------------------------------------------------
-- دالة 1: تحديث رصيد الحساب الفرعي وجميع الحسابات الأب صعوداً في الشجرة الهرمية
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_propagate_coa_balance(
  p_account_id UUID,
  p_debit      NUMERIC,
  p_credit     NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_leaf_balance_side balance_side_enum;
  v_signed_delta      NUMERIC(18, 4);
BEGIN
  SELECT normal_balance INTO v_leaf_balance_side
  FROM chart_of_accounts
  WHERE id = p_account_id;

  -- حساب الأثر الصافي حسب طبيعة الحساب (مدين أم دائن)
  v_signed_delta := CASE
    WHEN v_leaf_balance_side = 'debit' THEN (p_debit - p_credit)
    ELSE (p_credit - p_debit)
  END;

  -- ترحيل الأثر هرمياً من الحساب الفرعي حتى الجذر عبر استعلام تكراري
  WITH RECURSIVE account_tree AS (
    SELECT id, parent_id, normal_balance
    FROM chart_of_accounts
    WHERE id = p_account_id
    UNION ALL
    SELECT p.id, p.parent_id, p.normal_balance
    FROM chart_of_accounts p
    INNER JOIN account_tree c ON c.parent_id = p.id
  )
  UPDATE chart_of_accounts coa
  SET current_balance = coa.current_balance + (
    CASE
      WHEN coa.normal_balance = v_leaf_balance_side THEN v_signed_delta
      ELSE -v_signed_delta
    END
  )
  FROM account_tree t
  WHERE coa.id = t.id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- دالة 2: Trigger تلقائي عند إدراج أو حذف سطر قيد يومية مُرحّل
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_sync_je_line_to_coa()
RETURNS TRIGGER AS $$
DECLARE
  v_status   journal_status_enum;
  v_postable BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM journal_entries WHERE id = NEW.journal_entry_id;
    SELECT is_postable INTO v_postable FROM chart_of_accounts WHERE id = NEW.account_id;

    IF NOT COALESCE(v_postable, FALSE) THEN
      RAISE EXCEPTION 'لا يمكن الترحيل على حساب رئيسي تجميعي، اختر حساباً فرعياً.';
    END IF;

    IF v_status = 'posted' THEN
      PERFORM fn_propagate_coa_balance(NEW.account_id, NEW.debit, NEW.credit);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM journal_entries WHERE id = OLD.journal_entry_id;
    IF v_status = 'posted' THEN
      PERFORM fn_propagate_coa_balance(OLD.account_id, -OLD.debit, -OLD.credit);
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jel_coa_sync
  AFTER INSERT OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION trg_fn_sync_je_line_to_coa();

-- ----------------------------------------------------------------------------
-- دالة 3: التحقق المؤجل (DEFERRABLE) من توازن القيد المزدوج (المدين = الدائن)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_verify_je_balanced()
RETURNS TRIGGER AS $$
DECLARE
  v_je_id      UUID;
  v_sum_debit  NUMERIC(18, 4);
  v_sum_credit NUMERIC(18, 4);
  v_status     journal_status_enum;
BEGIN
  v_je_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  SELECT status INTO v_status FROM journal_entries WHERE id = v_je_id;

  IF v_status = 'posted' THEN
    SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
    INTO v_sum_debit, v_sum_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = v_je_id;

    IF v_sum_debit = 0 OR v_sum_debit <> v_sum_credit THEN
      RAISE EXCEPTION 'القيد المحاسبي غير متوازن: المدين (%) لا يساوي الدائن (%)',
        v_sum_debit, v_sum_credit;
    END IF;

    UPDATE journal_entries
    SET total_debit = v_sum_debit, total_credit = v_sum_credit
    WHERE id = v_je_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_je_enforce_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_fn_verify_je_balanced();`,
    explanationPoints: [
      {
        label: 'التحديث الهرمي التلقائي (WITH RECURSIVE)',
        detail: 'عند حفظ أي سطر قيد على حساب فرعي (مثل الصندوق الرئيسي)، تصعد الدالة تلقائياً عبر parent_id وتحدّث أرصدة النقدية والأصول المتداولة والأصول في لحظة واحدة.',
      },
      {
        label: 'حماية القيد المزدوج (DEFERRABLE TRIGGER)',
        detail: 'يتحقق PostgreSQL عند نهاية المعاملة من أن إجمالي المدين يساوي إجمالي الدائن تماماً، ويرفض حفظ أي قيد غير متوازن.',
      },
      {
        label: 'منع الترحيل على الحسابات التجميعية',
        detail: 'يتحقق التريجر من حقل is_postable = TRUE قبل الترحيل لحماية هيكل الشجرة المحاسبية.',
      },
    ],
  },
  {
    id: 'vouchers',
    phase: 3,
    shortLabel: 'سندات القبض والصرف',
    titleAr: '12. سندات القبض والصرف ودالة الترحيل الذرية (vouchers & rpc_post_voucher)',
    subtitleAr: 'حفظ سند القبض أو الصرف وتوليد قيد اليومية وتحديث رصيد العميل/المورد وشجرة الحسابات في معاملة واحدة',
    code: `-- ============================================================================
-- جدول سندات القبض والصرف (Receipt & Payment Vouchers)
-- ============================================================================
CREATE TYPE voucher_type_enum AS ENUM ('receipt', 'payment');
CREATE TYPE payment_method_enum AS ENUM ('cash', 'bank_transfer', 'cheque', 'pos_card');
CREATE TYPE voucher_party_enum AS ENUM ('customer', 'supplier', 'partner', 'other');

CREATE TABLE vouchers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_no           VARCHAR(30) NOT NULL UNIQUE,
  voucher_type         voucher_type_enum NOT NULL,
  voucher_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method       payment_method_enum NOT NULL DEFAULT 'cash',
  cash_bank_account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  counter_account_id   UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  party_type           voucher_party_enum NOT NULL DEFAULT 'other',
  customer_id          UUID REFERENCES customers(id) ON DELETE RESTRICT,
  supplier_id          UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  partner_id           UUID REFERENCES partners(id) ON DELETE RESTRICT,
  amount               NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  reference_no         VARCHAR(60),
  description          TEXT NOT NULL,
  journal_entry_id     UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by           UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vouchers_type_date ON vouchers(voucher_type, voucher_date);

-- ----------------------------------------------------------------------------
-- دالة RPC ذرية لتسجيل سند قبض أو صرف وتوليد القيد وتحديث الشجرة والعميل/المورد
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_post_voucher(
  p_voucher_no           VARCHAR,
  p_voucher_type         voucher_type_enum,
  p_voucher_date         DATE,
  p_payment_method       payment_method_enum,
  p_cash_bank_account_id UUID,
  p_counter_account_id   UUID,
  p_party_type           voucher_party_enum,
  p_party_id             UUID,
  p_amount               NUMERIC,
  p_reference_no         VARCHAR,
  p_description          TEXT,
  p_user_id              UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_je_id      UUID;
  v_voucher_id UUID;
  v_entry_no   VARCHAR(30);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'مبلغ السند يجب أن يكون أكبر من صفر.';
  END IF;

  v_entry_no := 'JV-' || p_voucher_no;

  -- 1. إنشاء رأس القيد المحاسبي
  INSERT INTO journal_entries (
    entry_no, entry_date, source_type, source_ref_no, description, status, created_by
  )
  VALUES (
    v_entry_no,
    p_voucher_date,
    CASE WHEN p_voucher_type = 'receipt' THEN 'receipt_voucher'::journal_source_enum
         ELSE 'payment_voucher'::journal_source_enum END,
    p_voucher_no,
    p_description,
    'posted',
    p_user_id
  )
  RETURNING id INTO v_je_id;

  -- 2. إدراج سطري القيد (مدين/دائن) مما يُفعّل تحديث شجرة الحسابات تلقائياً
  IF p_voucher_type = 'receipt' THEN
    -- سند قبض: من حـ/ الصندوق أو البنك (مدين) إلى حـ/ الطرف المقابل (دائن)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo)
    VALUES
      (v_je_id, p_cash_bank_account_id, p_amount, 0, p_description),
      (v_je_id, p_counter_account_id,   0, p_amount, p_description);
  ELSE
    -- سند صرف: من حـ/ الطرف المقابل (مدين) إلى حـ/ الصندوق أو البنك (دائن)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo)
    VALUES
      (v_je_id, p_counter_account_id,   p_amount, 0, p_description),
      (v_je_id, p_cash_bank_account_id, 0, p_amount, p_description);
  END IF;

  -- 3. حفظ السند وربطه بالقيد
  INSERT INTO vouchers (
    voucher_no, voucher_type, voucher_date, payment_method,
    cash_bank_account_id, counter_account_id, party_type,
    customer_id, supplier_id, partner_id,
    amount, reference_no, description, journal_entry_id, created_by
  )
  VALUES (
    p_voucher_no, p_voucher_type, p_voucher_date, p_payment_method,
    p_cash_bank_account_id, p_counter_account_id, p_party_type,
    CASE WHEN p_party_type = 'customer' THEN p_party_id ELSE NULL END,
    CASE WHEN p_party_type = 'supplier' THEN p_party_id ELSE NULL END,
    CASE WHEN p_party_type = 'partner'  THEN p_party_id ELSE NULL END,
    p_amount, p_reference_no, p_description, v_je_id, p_user_id
  )
  RETURNING id INTO v_voucher_id;

  -- 4. تحديث رصيد العميل أو المورد مباشرة
  IF p_party_type = 'customer' AND p_party_id IS NOT NULL THEN
    UPDATE customers
    SET current_balance = current_balance + (CASE WHEN p_voucher_type = 'receipt' THEN -p_amount ELSE p_amount END)
    WHERE id = p_party_id;
  ELSIF p_party_type = 'supplier' AND p_party_id IS NOT NULL THEN
    UPDATE suppliers
    SET current_balance = current_balance + (CASE WHEN p_voucher_type = 'payment' THEN -p_amount ELSE p_amount END)
    WHERE id = p_party_id;
  END IF;

  RETURN v_voucher_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
    explanationPoints: [
      {
        label: 'توجيه القيد الآلي للسندين',
        detail: 'سند القبض يجعل الصندوق/البنك مديناً والحساب المقابل دائناً، بينما سند الصرف يعكس القيد بجعل الحساب المقابل مديناً والصندوق/البنك دائناً.',
      },
      {
        label: 'تحديث أرصدة العملاء والموردين والشجرة معاً',
        detail: 'تُنفّذ دالة rpc_post_voucher كل الخطوات داخل Transaction واحدة، فإذا فشل أي جزء يتراجع PostgreSQL عن العملية بالكامل.',
      },
    ],
  },
  {
    id: 'financial_operations',
    phase: 3,
    shortLabel: 'المصروفات والإيرادات',
    titleAr: '13. المصروفات والإيرادات التشغيلية والنثرية (financial_operations & RPC)',
    subtitleAr: 'تسجيل المصروفات النثرية والتشغيلية والإيرادات مع احتساب الضريبة وتوليد القيد وتحديث الشجرة تلقائياً',
    code: `-- ============================================================================
-- جدول المصروفات والإيرادات التشغيلية والنثرية
-- ============================================================================
CREATE TYPE op_category_enum AS ENUM (
  'operating_expense',   -- مصروف تشغيلي (إيجار، كهرباء، صيانة)
  'petty_cash_expense',  -- مصروف نثري من العهدة
  'operating_revenue',   -- إيراد تشغيلي
  'other_revenue'        -- إيرادات متنوعة أخرى
);

CREATE TABLE financial_operations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_no                VARCHAR(30) NOT NULL UNIQUE,
  op_category          op_category_enum NOT NULL,
  op_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id           UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  payment_account_id   UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  warehouse_id         UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  amount               NUMERIC(18, 4) NOT NULL CHECK (amount > 0),
  tax_amount           NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount         NUMERIC(18, 4) GENERATED ALWAYS AS (amount + tax_amount) STORED,
  tax_account_id       UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  beneficiary_or_payer VARCHAR(150),
  notes                TEXT NOT NULL,
  journal_entry_id     UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by           UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- دالة RPC لتسجيل مصروف أو إيراد (مع ضريبة القيمة المضافة اختيارياً) وترحيله فوراً
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_record_financial_operation(
  p_op_no                VARCHAR,
  p_op_category          op_category_enum,
  p_op_date              DATE,
  p_account_id           UUID,
  p_payment_account_id   UUID,
  p_warehouse_id         UUID,
  p_amount               NUMERIC,
  p_tax_amount           NUMERIC,
  p_tax_account_id       UUID,
  p_beneficiary_or_payer VARCHAR,
  p_notes                TEXT,
  p_user_id              UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_je_id      UUID;
  v_op_id      UUID;
  v_total      NUMERIC(18, 4);
  v_is_expense BOOLEAN;
BEGIN
  v_total := p_amount + COALESCE(p_tax_amount, 0);
  v_is_expense := p_op_category IN ('operating_expense', 'petty_cash_expense');

  INSERT INTO journal_entries (
    entry_no, entry_date, source_type, source_ref_no, description, status, created_by
  )
  VALUES (
    'JV-' || p_op_no,
    p_op_date,
    CASE WHEN v_is_expense THEN 'operating_expense'::journal_source_enum
         ELSE 'operating_revenue'::journal_source_enum END,
    p_op_no,
    p_notes,
    'posted',
    p_user_id
  )
  RETURNING id INTO v_je_id;

  IF v_is_expense THEN
    -- إثبات المصروف (مدين) والضريبة إن وجدت (مدين) مقابل الصندوق/العهدة (دائن)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id)
    VALUES
      (v_je_id, p_account_id,         p_amount, 0,       p_notes, p_warehouse_id),
      (v_je_id, p_payment_account_id, 0,        v_total, p_notes, p_warehouse_id);

    IF COALESCE(p_tax_amount, 0) > 0 AND p_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id)
      VALUES (v_je_id, p_tax_account_id, p_tax_amount, 0, 'ضريبة مدخلات — ' || p_op_no, p_warehouse_id);
    END IF;
  ELSE
    -- إثبات التحصيل في الصندوق/البنك (مدين) مقابل الإيراد (دائن) والضريبة (دائن)
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id)
    VALUES
      (v_je_id, p_payment_account_id, v_total, 0,        p_notes, p_warehouse_id),
      (v_je_id, p_account_id,         0,       p_amount, p_notes, p_warehouse_id);

    IF COALESCE(p_tax_amount, 0) > 0 AND p_tax_account_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id)
      VALUES (v_je_id, p_tax_account_id, 0, p_tax_amount, 'ضريبة مخرجات — ' || p_op_no, p_warehouse_id);
    END IF;
  END IF;

  INSERT INTO financial_operations (
    op_no, op_category, op_date, account_id, payment_account_id,
    warehouse_id, amount, tax_amount, tax_account_id,
    beneficiary_or_payer, notes, journal_entry_id, created_by
  )
  VALUES (
    p_op_no, p_op_category, p_op_date, p_account_id, p_payment_account_id,
    p_warehouse_id, p_amount, COALESCE(p_tax_amount, 0), p_tax_account_id,
    p_beneficiary_or_payer, p_notes, v_je_id, p_user_id
  )
  RETURNING id INTO v_op_id;

  RETURN v_op_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تفعيل حماية RLS على جداول المرحلة الثالثة
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_operations ENABLE ROW LEVEL SECURITY;`,
    explanationPoints: [
      {
        label: 'استدعاء مباشر من الواجهة عبر Supabase RPC',
        detail: 'يمكن للتطبيق استدعاء supabase.rpc("rpc_record_financial_operation", ...) لتنفيذ العملية وتحديث شجرة الحسابات بالكامل داخل قاعدة البيانات.',
      },
      {
        label: 'دعم مراكز التكلفة (warehouse_id) والضريبة',
        detail: 'يُحتسب الإجمالي (total_amount) تلقائياً عبر عمود GENERATED، ويُرحّل مبلغ الضريبة في سطر قيد مستقل.',
      },
    ],
  },

  // ==========================================================================
  // PHASE 4: المخازن والأصناف والفواتير والتسويات الجردية
  // ==========================================================================
  {
    id: 'warehouse_stocks',
    phase: 4,
    shortLabel: 'أرصدة المستودعات والحركة',
    titleAr: '14. أرصدة المستودعات وسجل حركات المخزون (warehouse_stocks & stock_movements)',
    subtitleAr: 'تتبع الرصيد الفعلي لكل صنف داخل كل مستودع بالوحدة الأساسية ومنع الصرف على المكشوف',
    code: `-- ============================================================================
-- المرحلة 4: المخازن، الفواتير (مبيعات/مشتريات/مرتجعات)، والتسويات الجردية
-- ============================================================================

-- توسيع أنواع مصادر قيود اليومية لتشمل الفواتير والمرتجعات والتسويات الجردية
ALTER TYPE journal_source_enum ADD VALUE IF NOT EXISTS 'purchase_invoice';
ALTER TYPE journal_source_enum ADD VALUE IF NOT EXISTS 'purchase_return';
ALTER TYPE journal_source_enum ADD VALUE IF NOT EXISTS 'sales_invoice';
ALTER TYPE journal_source_enum ADD VALUE IF NOT EXISTS 'sales_return';
ALTER TYPE journal_source_enum ADD VALUE IF NOT EXISTS 'inventory_adjustment';

-- جدول أرصدة الأصناف في كل مستودع (بالوحدة الأساسية للصنف base_unit)
CREATE TABLE warehouse_stocks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  item_id          UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity_on_hand NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  last_cost        NUMERIC(18, 4) NOT NULL DEFAULT 0 CHECK (last_cost >= 0),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, item_id)
);

CREATE INDEX idx_ws_warehouse ON warehouse_stocks(warehouse_id);
CREATE INDEX idx_ws_item ON warehouse_stocks(item_id);

-- جدول سجل حركات المخزون التفصيلي (كارت الصنف / Audit Trail)
CREATE TYPE stock_movement_enum AS ENUM (
  'purchase_in', 'purchase_return_out', 'sale_out', 'sales_return_in', 'adjustment_in', 'adjustment_out'
);

CREATE TABLE stock_movements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id  UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  movement_type stock_movement_enum NOT NULL,
  qty_delta     NUMERIC(18, 4) NOT NULL, -- موجب للوارد، سالب للمنصرف (بالوحدة الأساسية)
  unit_cost     NUMERIC(18, 4) NOT NULL DEFAULT 0,
  source_ref_no VARCHAR(40) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sm_wh_item ON stock_movements(warehouse_id, item_id);
CREATE INDEX idx_sm_ref ON stock_movements(source_ref_no);`,
    explanationPoints: [
      {
        label: 'التخزين بالوحدة الأساسية (quantity_on_hand)',
        detail: 'يُخزّن الرصيد دائماً بالوحدة الأساسية للصنف بعد ضرب كمية الفاتورة في معامل التحويل (conversion_factor)، مع قيد CHECK (>= 0) يمنع السحب على المكشوف.',
      },
      {
        label: 'بطاقة الصنف (stock_movements)',
        detail: 'يسجل كل حركة وارد أو منصرف أو تسوية جردية مع تكلفتها ورقم المستند المرجعي لتتبع حركة المخزون بدقة.',
      },
    ],
  },
  {
    id: 'purchase_invoices',
    phase: 4,
    shortLabel: 'فواتير ومرتجعات المشتريات',
    titleAr: '15. فواتير المشتريات والمرتجعات وتحديث المتوسط المرجح للتكلفة (WAC)',
    subtitleAr: 'زيادة المخزون وتحديث cost_price بالمتوسط المرجح وتوليد قيد المشتريات والضريبة وذمم المورد تلقائياً',
    code: `-- ============================================================================
-- فواتير المشتريات ومرتجعات المشتريات (Purchase Invoices & Returns)
-- ============================================================================
CREATE TYPE invoice_payment_mode_enum AS ENUM ('cash', 'credit');
CREATE TYPE purchase_invoice_type_enum AS ENUM ('purchase', 'purchase_return');

CREATE TABLE purchase_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no       VARCHAR(30) NOT NULL UNIQUE,
  invoice_type     purchase_invoice_type_enum NOT NULL DEFAULT 'purchase',
  invoice_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id      UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  payment_mode     invoice_payment_mode_enum NOT NULL DEFAULT 'credit',
  cash_account_id  UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  subtotal         NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes            TEXT,
  journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by       UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE purchase_invoice_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id UUID NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_id             UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  quantity            NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  conversion_factor   NUMERIC(18, 6) NOT NULL DEFAULT 1,
  base_quantity       NUMERIC(18, 4) GENERATED ALWAYS AS (quantity * conversion_factor) STORED,
  unit_price          NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
  line_total          NUMERIC(18, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ----------------------------------------------------------------------------
-- دالة RPC ذرية: ترحيل فاتورة/مرتجع مشتريات + تحديث المخزون والتكلفة (WAC) + القيد
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_post_purchase_invoice(
  p_invoice_no       VARCHAR,
  p_invoice_type     purchase_invoice_type_enum,
  p_invoice_date     DATE,
  p_supplier_id      UUID,
  p_warehouse_id     UUID,
  p_payment_mode     invoice_payment_mode_enum,
  p_cash_account_id  UUID,
  p_vat_account_id   UUID,
  p_lines            JSONB, -- [{"item_id":"...","unit_id":"...","quantity":2,"unit_price":4452}]
  p_notes            TEXT DEFAULT '',
  p_user_id          UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_inv_id         UUID;
  v_je_id          UUID;
  v_inv_acc_id     UUID;
  v_payable_acc_id UUID;
  v_settlement_acc UUID;
  v_line           JSONB;
  v_item           RECORD;
  v_conv           NUMERIC(18, 6);
  v_qty            NUMERIC(18, 4);
  v_base_qty       NUMERIC(18, 4);
  v_unit_price     NUMERIC(18, 4);
  v_line_total     NUMERIC(18, 4);
  v_cost_per_base  NUMERIC(18, 4);
  v_old_global_qty NUMERIC(18, 4);
  v_new_wac        NUMERIC(18, 4);
  v_subtotal       NUMERIC(18, 4) := 0;
  v_tax            NUMERIC(18, 4);
  v_total          NUMERIC(18, 4);
  v_wh_qty         NUMERIC(18, 4);
BEGIN
  SELECT inventory_account_id INTO v_inv_acc_id FROM warehouses WHERE id = p_warehouse_id;
  SELECT payable_account_id INTO v_payable_acc_id FROM suppliers WHERE id = p_supplier_id;
  v_settlement_acc := CASE WHEN p_payment_mode = 'cash' THEN p_cash_account_id ELSE v_payable_acc_id END;

  INSERT INTO purchase_invoices (
    invoice_no, invoice_type, invoice_date, supplier_id, warehouse_id,
    payment_mode, cash_account_id, notes, created_by
  ) VALUES (
    p_invoice_no, p_invoice_type, p_invoice_date, p_supplier_id, p_warehouse_id,
    p_payment_mode, p_cash_account_id, p_notes, p_user_id
  ) RETURNING id INTO v_inv_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_item FROM items WHERE id = (v_line->>'item_id')::UUID;
    SELECT conversion_factor INTO v_conv FROM units WHERE id = (v_line->>'unit_id')::UUID;

    v_qty := (v_line->>'quantity')::NUMERIC;
    v_unit_price := (v_line->>'unit_price')::NUMERIC;
    v_base_qty := v_qty * v_conv;
    v_line_total := v_qty * v_unit_price;
    v_cost_per_base := v_unit_price / v_conv;
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO purchase_invoice_lines (
      purchase_invoice_id, item_id, unit_id, quantity, conversion_factor, unit_price
    ) VALUES (
      v_inv_id, v_item.id, (v_line->>'unit_id')::UUID, v_qty, v_conv, v_unit_price
    );

    IF v_item.item_type = 'stock' THEN
      IF p_invoice_type = 'purchase' THEN
        -- حساب المتوسط المرجح للتكلفة (WAC) قبل إضافة الكمية الجديدة
        SELECT COALESCE(SUM(quantity_on_hand), 0) INTO v_old_global_qty
        FROM warehouse_stocks WHERE item_id = v_item.id;

        IF (v_old_global_qty + v_base_qty) > 0 THEN
          v_new_wac := ((v_old_global_qty * v_item.cost_price) + v_line_total) / (v_old_global_qty + v_base_qty);
          UPDATE items SET cost_price = ROUND(v_new_wac, 4) WHERE id = v_item.id;
        END IF;

        -- زيادة رصيد المستودع (UPSERT)
        INSERT INTO warehouse_stocks (warehouse_id, item_id, quantity_on_hand, last_cost)
        VALUES (p_warehouse_id, v_item.id, v_base_qty, v_cost_per_base)
        ON CONFLICT (warehouse_id, item_id) DO UPDATE
        SET quantity_on_hand = warehouse_stocks.quantity_on_hand + EXCLUDED.quantity_on_hand,
            last_cost = EXCLUDED.last_cost,
            updated_at = NOW();

        INSERT INTO stock_movements (movement_date, warehouse_id, item_id, movement_type, qty_delta, unit_cost, source_ref_no, notes)
        VALUES (p_invoice_date, p_warehouse_id, v_item.id, 'purchase_in', v_base_qty, v_cost_per_base, p_invoice_no, p_notes);
      ELSE
        -- مرتجع مشتريات: التحقق من توفر الرصيد ثم خصمه من المستودع
        SELECT COALESCE(quantity_on_hand, 0) INTO v_wh_qty
        FROM warehouse_stocks WHERE warehouse_id = p_warehouse_id AND item_id = v_item.id;

        IF v_wh_qty < v_base_qty THEN
          RAISE EXCEPTION 'الرصيد المتاح في المستودع لا يكفي لإرجاع الصنف (%)', v_item.name_ar;
        END IF;

        UPDATE warehouse_stocks
        SET quantity_on_hand = quantity_on_hand - v_base_qty, updated_at = NOW()
        WHERE warehouse_id = p_warehouse_id AND item_id = v_item.id;

        INSERT INTO stock_movements (movement_date, warehouse_id, item_id, movement_type, qty_delta, unit_cost, source_ref_no, notes)
        VALUES (p_invoice_date, p_warehouse_id, v_item.id, 'purchase_return_out', -v_base_qty, v_cost_per_base, p_invoice_no, p_notes);
      END IF;
    END IF;
  END LOOP;

  v_tax := ROUND(v_subtotal * 0.15, 2);
  v_total := v_subtotal + v_tax;

  -- توليد القيد المحاسبي (عكس القيد في حالة المرتجع)
  INSERT INTO journal_entries (entry_no, entry_date, source_type, source_ref_no, description, status, created_by)
  VALUES (
    'JV-' || p_invoice_no,
    p_invoice_date,
    CASE WHEN p_invoice_type = 'purchase' THEN 'purchase_invoice'::journal_source_enum
         ELSE 'purchase_return'::journal_source_enum END,
    p_invoice_no,
    COALESCE(NULLIF(p_notes, ''), 'قيد ' || p_invoice_no),
    'posted',
    p_user_id
  ) RETURNING id INTO v_je_id;

  IF p_invoice_type = 'purchase' THEN
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
      (v_je_id, v_inv_acc_id,     v_subtotal, 0,       'توريد مخزون — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, p_vat_account_id, v_tax,      0,       'ضريبة مدخلات 15% — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, v_settlement_acc, 0,          v_total, 'استحقاق/سداد مشتريات — ' || p_invoice_no, p_warehouse_id);
  ELSE
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
      (v_je_id, v_settlement_acc, v_total, 0,          'تخفيض ذمم المورد/استرداد — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, v_inv_acc_id,     0,       v_subtotal, 'عكس مخزون مرتجع مشتريات — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, p_vat_account_id, 0,       v_tax,      'عكس ضريبة مدخلات — ' || p_invoice_no, p_warehouse_id);
  END IF;

  UPDATE purchase_invoices
  SET subtotal = v_subtotal, tax_amount = v_tax, total_amount = v_total, journal_entry_id = v_je_id
  WHERE id = v_inv_id;

  IF p_payment_mode = 'credit' THEN
    UPDATE suppliers
    SET current_balance = current_balance + (CASE WHEN p_invoice_type = 'purchase' THEN v_total ELSE -v_total END)
    WHERE id = p_supplier_id;
  END IF;

  RETURN v_inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
    explanationPoints: [
      {
        label: 'المتوسط المرجح للتكلفة (Weighted Average Cost)',
        detail: 'عند كل فاتورة شراء، تحسب الدالة متوسط التكلفة الجديد = (قيمة الرصيد القديم + قيمة الشراء الجديد) ÷ (الكمية القديمة + الجديدة) وتحدّث cost_price في بطاقة الصنف تلقائياً.',
      },
      {
        label: 'عكس القيد والمخزون في المرتجع',
        detail: 'عند اختيار purchase_return، تتحقق الدالة من وجود كمية كافية في المستودع لردّها للمورد، ثم تخصمها وتعكس قيد المخزون والضريبة وذمة المورد.',
      },
    ],
  },
  {
    id: 'sales_invoices',
    phase: 4,
    shortLabel: 'فواتير ومرتجعات المبيعات',
    titleAr: '16. فواتير المبيعات النقدية والآجلة والمرتجعات وتوليد قيد الإيراد و COGS تلقائياً',
    subtitleAr: 'التحقق من الرصيد والحد الائتماني، خصم المستودع، وتوليد قيد المبيعات وقيد تكلفة البضاعة المباعة',
    code: `-- ============================================================================
-- فواتير المبيعات النقدية والآجلة ومرتجعات المبيعات (Sales Invoices & Returns)
-- ============================================================================
CREATE TYPE sales_invoice_type_enum AS ENUM ('sale', 'sales_return');

CREATE TABLE sales_invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no       VARCHAR(30) NOT NULL UNIQUE,
  invoice_type     sales_invoice_type_enum NOT NULL DEFAULT 'sale',
  invoice_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  payment_mode     invoice_payment_mode_enum NOT NULL DEFAULT 'cash',
  cash_account_id  UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  subtotal         NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total_cogs       NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes            TEXT,
  journal_entry_id UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by       UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sales_invoice_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  item_id          UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  unit_id          UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  quantity         NUMERIC(18, 4) NOT NULL CHECK (quantity > 0),
  conversion_factor NUMERIC(18, 6) NOT NULL DEFAULT 1,
  base_quantity    NUMERIC(18, 4) GENERATED ALWAYS AS (quantity * conversion_factor) STORED,
  unit_price       NUMERIC(18, 4) NOT NULL CHECK (unit_price >= 0),
  cost_snapshot    NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total       NUMERIC(18, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ----------------------------------------------------------------------------
-- دالة RPC ذرية: بيع نقدي/آجل أو مرتجع مبيعات + خصم المستودع + قيد مزدوج (إيراد + COGS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_post_sales_invoice(
  p_invoice_no      VARCHAR,
  p_invoice_type    sales_invoice_type_enum,
  p_invoice_date    DATE,
  p_customer_id     UUID,
  p_warehouse_id    UUID,
  p_payment_mode    invoice_payment_mode_enum,
  p_cash_account_id UUID,
  p_vat_account_id  UUID,
  p_lines           JSONB,
  p_notes           TEXT DEFAULT '',
  p_user_id         UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_inv_id         UUID;
  v_je_id          UUID;
  v_cust           RECORD;
  v_wh_inv_acc_id  UUID;
  v_settlement_acc UUID;
  v_rev_acc_id     UUID;
  v_cogs_acc_id    UUID;
  v_line           JSONB;
  v_item           RECORD;
  v_conv           NUMERIC(18, 6);
  v_qty            NUMERIC(18, 4);
  v_base_qty       NUMERIC(18, 4);
  v_unit_price     NUMERIC(18, 4);
  v_line_total     NUMERIC(18, 4);
  v_line_cogs      NUMERIC(18, 4);
  v_wh_qty         NUMERIC(18, 4);
  v_subtotal       NUMERIC(18, 4) := 0;
  v_total_cogs     NUMERIC(18, 4) := 0;
  v_tax            NUMERIC(18, 4);
  v_total          NUMERIC(18, 4);
BEGIN
  SELECT * INTO v_cust FROM customers WHERE id = p_customer_id;
  SELECT inventory_account_id INTO v_wh_inv_acc_id FROM warehouses WHERE id = p_warehouse_id;
  v_settlement_acc := CASE WHEN p_payment_mode = 'cash' THEN p_cash_account_id ELSE v_cust.receivable_account_id END;

  INSERT INTO sales_invoices (
    invoice_no, invoice_type, invoice_date, customer_id, warehouse_id,
    payment_mode, cash_account_id, notes, created_by
  ) VALUES (
    p_invoice_no, p_invoice_type, p_invoice_date, p_customer_id, p_warehouse_id,
    p_payment_mode, p_cash_account_id, p_notes, p_user_id
  ) RETURNING id INTO v_inv_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_item FROM items WHERE id = (v_line->>'item_id')::UUID;
    SELECT conversion_factor INTO v_conv FROM units WHERE id = (v_line->>'unit_id')::UUID;

    v_qty := (v_line->>'quantity')::NUMERIC;
    v_unit_price := (v_line->>'unit_price')::NUMERIC;
    v_base_qty := v_qty * v_conv;
    v_line_total := v_qty * v_unit_price;
    v_line_cogs := ROUND(v_base_qty * v_item.cost_price, 4);
    v_subtotal := v_subtotal + v_line_total;
    v_rev_acc_id := COALESCE(v_rev_acc_id, v_item.revenue_account_id);
    v_cogs_acc_id := COALESCE(v_cogs_acc_id, v_item.cogs_account_id);

    INSERT INTO sales_invoice_lines (
      sales_invoice_id, item_id, unit_id, quantity, conversion_factor, unit_price, cost_snapshot
    ) VALUES (
      v_inv_id, v_item.id, (v_line->>'unit_id')::UUID, v_qty, v_conv, v_unit_price, v_item.cost_price
    );

    IF v_item.item_type = 'stock' THEN
      v_total_cogs := v_total_cogs + v_line_cogs;

      IF p_invoice_type = 'sale' THEN
        SELECT COALESCE(quantity_on_hand, 0) INTO v_wh_qty
        FROM warehouse_stocks WHERE warehouse_id = p_warehouse_id AND item_id = v_item.id;

        IF v_wh_qty < v_base_qty THEN
          RAISE EXCEPTION 'الكمية المتوفرة في المستودع لا تكفي لصرف الصنف (%)', v_item.name_ar;
        END IF;

        UPDATE warehouse_stocks
        SET quantity_on_hand = quantity_on_hand - v_base_qty, updated_at = NOW()
        WHERE warehouse_id = p_warehouse_id AND item_id = v_item.id;

        INSERT INTO stock_movements (movement_date, warehouse_id, item_id, movement_type, qty_delta, unit_cost, source_ref_no, notes)
        VALUES (p_invoice_date, p_warehouse_id, v_item.id, 'sale_out', -v_base_qty, v_item.cost_price, p_invoice_no, p_notes);
      ELSE
        -- مرتجع مبيعات: إعادة الكمية إلى المستودع المحدد
        INSERT INTO warehouse_stocks (warehouse_id, item_id, quantity_on_hand, last_cost)
        VALUES (p_warehouse_id, v_item.id, v_base_qty, v_item.cost_price)
        ON CONFLICT (warehouse_id, item_id) DO UPDATE
        SET quantity_on_hand = warehouse_stocks.quantity_on_hand + EXCLUDED.quantity_on_hand,
            updated_at = NOW();

        INSERT INTO stock_movements (movement_date, warehouse_id, item_id, movement_type, qty_delta, unit_cost, source_ref_no, notes)
        VALUES (p_invoice_date, p_warehouse_id, v_item.id, 'sales_return_in', v_base_qty, v_item.cost_price, p_invoice_no, p_notes);
      END IF;
    END IF;
  END LOOP;

  v_tax := ROUND(v_subtotal * 0.15, 2);
  v_total := v_subtotal + v_tax;

  -- فحص الحد الائتماني في المبيعات الآجلة
  IF p_invoice_type = 'sale' AND p_payment_mode = 'credit' THEN
    IF (v_cust.current_balance + v_total) > v_cust.credit_limit THEN
      RAISE EXCEPTION 'تجاوز الحد الائتماني المسموح للعميل (%)', v_cust.name_ar;
    END IF;
  END IF;

  INSERT INTO journal_entries (entry_no, entry_date, source_type, source_ref_no, description, status, created_by)
  VALUES (
    'JV-' || p_invoice_no,
    p_invoice_date,
    CASE WHEN p_invoice_type = 'sale' THEN 'sales_invoice'::journal_source_enum
         ELSE 'sales_return'::journal_source_enum END,
    p_invoice_no,
    COALESCE(NULLIF(p_notes, ''), 'قيد ' || p_invoice_no),
    'posted',
    p_user_id
  ) RETURNING id INTO v_je_id;

  IF p_invoice_type = 'sale' THEN
    -- الطرف الأول: إثبات المبيعات والضريبة
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
      (v_je_id, v_settlement_acc, v_total, 0,          'مبيعات (' || p_payment_mode || ') — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, v_rev_acc_id,     0,       v_subtotal, 'إيراد مبيعات — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, p_vat_account_id, 0,       v_tax,      'ضريبة مخرجات 15% — ' || p_invoice_no, p_warehouse_id);

    -- الطرف الثاني: إثبات تكلفة البضاعة المباعة (COGS) وخصم المخزون
    IF v_total_cogs > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
        (v_je_id, v_cogs_acc_id,   v_total_cogs, 0,            'تكلفة البضاعة المباعة — ' || p_invoice_no, p_warehouse_id),
        (v_je_id, v_wh_inv_acc_id, 0,            v_total_cogs, 'صرف مخزون مباع — ' || p_invoice_no, p_warehouse_id);
    END IF;
  ELSE
    -- عكس المبيعات والتكلفة عند المرتجع
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
      (v_je_id, v_rev_acc_id,     v_subtotal, 0,       'عكس إيراد مرتجع مبيعات — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, p_vat_account_id, v_tax,      0,       'عكس ضريبة مخرجات — ' || p_invoice_no, p_warehouse_id),
      (v_je_id, v_settlement_acc, 0,          v_total, 'تخفيض ذمة العميل/رد نقدية — ' || p_invoice_no, p_warehouse_id);

    IF v_total_cogs > 0 THEN
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
        (v_je_id, v_wh_inv_acc_id, v_total_cogs, 0,            'إعادة مخزون مرتجع مبيعات — ' || p_invoice_no, p_warehouse_id),
        (v_je_id, v_cogs_acc_id,   0,            v_total_cogs, 'عكس تكلفة البضاعة المباعة — ' || p_invoice_no, p_warehouse_id);
    END IF;
  END IF;

  UPDATE sales_invoices
  SET subtotal = v_subtotal, tax_amount = v_tax, total_amount = v_total, total_cogs = v_total_cogs, journal_entry_id = v_je_id
  WHERE id = v_inv_id;

  IF p_payment_mode = 'credit' THEN
    UPDATE customers
    SET current_balance = current_balance + (CASE WHEN p_invoice_type = 'sale' THEN v_total ELSE -v_total END)
    WHERE id = p_customer_id;
  END IF;

  RETURN v_inv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
    explanationPoints: [
      {
        label: 'القيد المزدوج المتكامل للمبيعات (الجرد المستمر)',
        detail: 'يولّد النظام سطور الإيراد والضريبة (مدين: النقدية/العميل، دائن: المبيعات والضريبة) بالتوازي مع سطور التكلفة (مدين: تكلفة البضاعة المباعة، دائن: المخزون) في قيد واحد.',
      },
      {
        label: 'حماية الحد الائتماني ورصيد المستودع',
        detail: 'ترفض الدالة الترحيل فوراً إذا لم يكفِ الرصيد المخزني في المستودع المحدد أو إذا تجاوزت الفاتورة الآجلة الحد الائتماني للعميل.',
      },
    ],
  },
  {
    id: 'inventory_adjustments',
    phase: 4,
    shortLabel: 'التسويات الجردية للمخازن',
    titleAr: '17. التسويات الجردية ومعالجة العجز والزيادة والتلف (inventory_adjustments)',
    subtitleAr: 'مطابقة الجرد الفعلي بالرصيد الدفتري وتعديل المخزون وتوليد قيود فروقات الجرد والتلف تلقائياً',
    code: `-- ============================================================================
-- التسويات الجردية للمخازن (Inventory Adjustments)
-- ============================================================================
CREATE TYPE adjustment_reason_enum AS ENUM ('surplus', 'shortage', 'damage', 'book_variance');

CREATE TABLE inventory_adjustments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_no        VARCHAR(30) NOT NULL UNIQUE,
  adjustment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id         UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  reason               adjustment_reason_enum NOT NULL,
  total_variance_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes                TEXT,
  journal_entry_id     UUID UNIQUE REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by           UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_adjustment_lines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  system_qty    NUMERIC(18, 4) NOT NULL,
  actual_qty    NUMERIC(18, 4) NOT NULL CHECK (actual_qty >= 0),
  variance_qty  NUMERIC(18, 4) GENERATED ALWAYS AS (actual_qty - system_qty) STORED,
  unit_cost     NUMERIC(18, 4) NOT NULL,
  variance_val  NUMERIC(18, 4) GENERATED ALWAYS AS ((actual_qty - system_qty) * unit_cost) STORED
);

-- ----------------------------------------------------------------------------
-- دالة RPC لتنفيذ التسوية الجردية ومعالجة العجز/الزيادة/التلف/الفروقات الدفترية
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rpc_post_inventory_adjustment(
  p_adjustment_no  VARCHAR,
  p_adjustment_date DATE,
  p_warehouse_id   UUID,
  p_reason         adjustment_reason_enum,
  p_loss_acc_id    UUID, -- مثال: 5205 خسائر عجز وتلف المخزون
  p_gain_acc_id    UUID, -- مثال: 4201 إيرادات تشغيلية متنوعة (زيادة جردية)
  p_lines          JSONB, -- [{"item_id":"...","actual_qty":90}]
  p_notes          TEXT DEFAULT '',
  p_user_id        UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_adj_id        UUID;
  v_je_id         UUID;
  v_wh_inv_acc_id UUID;
  v_line          JSONB;
  v_item          RECORD;
  v_sys_qty       NUMERIC(18, 4);
  v_act_qty       NUMERIC(18, 4);
  v_diff_qty      NUMERIC(18, 4);
  v_diff_val      NUMERIC(18, 4);
  v_net_val       NUMERIC(18, 4) := 0;
BEGIN
  SELECT inventory_account_id INTO v_wh_inv_acc_id FROM warehouses WHERE id = p_warehouse_id;

  INSERT INTO inventory_adjustments (adjustment_no, adjustment_date, warehouse_id, reason, notes, created_by)
  VALUES (p_adjustment_no, p_adjustment_date, p_warehouse_id, p_reason, p_notes, p_user_id)
  RETURNING id INTO v_adj_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    SELECT * INTO v_item FROM items WHERE id = (v_line->>'item_id')::UUID;
    SELECT COALESCE(quantity_on_hand, 0) INTO v_sys_qty
    FROM warehouse_stocks WHERE warehouse_id = p_warehouse_id AND item_id = v_item.id;

    v_act_qty := (v_line->>'actual_qty')::NUMERIC;
    v_diff_qty := v_act_qty - v_sys_qty;
    v_diff_val := ROUND(v_diff_qty * v_item.cost_price, 4);
    v_net_val := v_net_val + v_diff_val;

    INSERT INTO inventory_adjustment_lines (adjustment_id, item_id, system_qty, actual_qty, unit_cost)
    VALUES (v_adj_id, v_item.id, v_sys_qty, v_act_qty, v_item.cost_price);

    INSERT INTO warehouse_stocks (warehouse_id, item_id, quantity_on_hand, last_cost)
    VALUES (p_warehouse_id, v_item.id, v_act_qty, v_item.cost_price)
    ON CONFLICT (warehouse_id, item_id) DO UPDATE
    SET quantity_on_hand = EXCLUDED.quantity_on_hand, updated_at = NOW();

    IF v_diff_qty <> 0 THEN
      INSERT INTO stock_movements (movement_date, warehouse_id, item_id, movement_type, qty_delta, unit_cost, source_ref_no, notes)
      VALUES (
        p_adjustment_date, p_warehouse_id, v_item.id,
        CASE WHEN v_diff_qty > 0 THEN 'adjustment_in'::stock_movement_enum ELSE 'adjustment_out'::stock_movement_enum END,
        v_diff_qty, v_item.cost_price, p_adjustment_no, p_notes
      );
    END IF;
  END LOOP;

  IF v_net_val <> 0 THEN
    INSERT INTO journal_entries (entry_no, entry_date, source_type, source_ref_no, description, status, created_by)
    VALUES ('JV-' || p_adjustment_no, p_adjustment_date, 'inventory_adjustment', p_adjustment_no, COALESCE(NULLIF(p_notes, ''), 'تسوية جردية ' || p_adjustment_no), 'posted', p_user_id)
    RETURNING id INTO v_je_id;

    IF v_net_val > 0 THEN
      -- زيادة مخزنية: من حـ/ المخزون (مدين) إلى حـ/ إيرادات فروقات الجرد (دائن)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
        (v_je_id, v_wh_inv_acc_id, ABS(v_net_val), 0,              'إثبات زيادة جردية — ' || p_adjustment_no, p_warehouse_id),
        (v_je_id, p_gain_acc_id,   0,              ABS(v_net_val), 'أرباح فروقات جرد — ' || p_adjustment_no, p_warehouse_id);
    ELSE
      -- عجز أو تلف: من حـ/ خسائر عجز وتلف المخزون (مدين) إلى حـ/ المخزون (دائن)
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, line_memo, warehouse_id) VALUES
        (v_je_id, p_loss_acc_id,   ABS(v_net_val), 0,              'خسائر عجز/تلف مخزني — ' || p_adjustment_no, p_warehouse_id),
        (v_je_id, v_wh_inv_acc_id, 0,              ABS(v_net_val), 'تخفيض المخزون بالعجز/التلف — ' || p_adjustment_no, p_warehouse_id);
    END IF;
  END IF;

  UPDATE inventory_adjustments
  SET total_variance_value = v_net_val, journal_entry_id = v_je_id
  WHERE id = v_adj_id;

  RETURN v_adj_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تفعيل RLS على جداول المرحلة الرابعة
ALTER TABLE warehouse_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_adjustment_lines ENABLE ROW LEVEL SECURITY;`,
    explanationPoints: [
      {
        label: 'التوجيه المحاسبي التلقائي لفروقات الجرد',
        detail: 'الزيادة الفعلية عن الدفتري تُثبت كأصل مخزني مدين وحساب إيراد دائن (4201)، بينما العجز أو التلف يُحمّل على حساب خسائر عجز وتلف المخزون (5205) ويُخفض رصيد المخزون.',
      },
      {
        label: 'حساب الفروقات بأعمدة GENERATED',
        detail: 'يُحسب فرق الكمية (actual_qty - system_qty) وقيمته المالية تلقائياً في قاعدة البيانات بتكلفة الصنف الحالية.',
      },
    ],
  },

  // ==========================================================================
  // PHASE 5: التقارير الختامية والتحليلية (المالية، المخزون، الأطراف، الشركاء)
  // ==========================================================================
  {
    id: 'financial_reports_sql',
    phase: 5,
    shortLabel: 'التقارير المالية (ميزان/دخل/ميزانية/أستاذ)',
    titleAr: '18. التقارير المالية الختامية ودفتر الأستاذ (Trial Balance, P&L, Balance Sheet, GL)',
    subtitleAr: 'استعلامات SQL ودوال RPC لحساب ميزان المراجعة وقائمة الدخل والمركز المالي ودفتر الأستاذ بالرصيد المتحرك',
    code: `-- ============================================================================
-- المرحلة 5: التقارير المالية الختامية والتحليلية
-- ============================================================================

-- 1) ميزان المراجعة بالأرصدة والمجاميع (Trial Balance View)
CREATE OR REPLACE VIEW vw_trial_balance AS
SELECT
  coa.id AS account_id,
  coa.code,
  coa.name_ar,
  coa.account_type,
  coa.normal_balance,
  COALESCE(SUM(jel.debit), 0)  AS total_debit,
  COALESCE(SUM(jel.credit), 0) AS total_credit,
  GREATEST(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0), 0) AS ending_debit,
  GREATEST(COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0), 0) AS ending_credit
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE coa.is_postable = TRUE
GROUP BY coa.id, coa.code, coa.name_ar, coa.account_type, coa.normal_balance
ORDER BY coa.code;

-- 2) قائمة الدخل (Income Statement / P&L View)
CREATE OR REPLACE VIEW vw_income_statement AS
SELECT
  coa.code,
  coa.name_ar,
  coa.account_type,
  CASE
    WHEN coa.account_type = 'revenue' THEN COALESCE(SUM(jel.credit - jel.debit), 0)
    WHEN coa.account_type = 'expense' THEN COALESCE(SUM(jel.debit - jel.credit), 0)
    ELSE 0
  END AS net_amount
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE coa.is_postable = TRUE
  AND coa.account_type IN ('revenue', 'expense')
GROUP BY coa.id, coa.code, coa.name_ar, coa.account_type
ORDER BY coa.account_type DESC, coa.code;

-- 3) قائمة المركز المالي / الميزانية العمومية (Balance Sheet مع ترحيل صافي الربح)
CREATE OR REPLACE VIEW vw_balance_sheet AS
WITH net_profit AS (
  SELECT COALESCE(SUM(
    CASE
      WHEN coa.account_type = 'revenue' THEN (jel.credit - jel.debit)
      WHEN coa.account_type = 'expense' THEN -(jel.debit - jel.credit)
      ELSE 0
    END
  ), 0) AS current_period_profit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  JOIN chart_of_accounts coa ON coa.id = jel.account_id
)
SELECT
  coa.code,
  coa.name_ar,
  coa.account_type AS section,
  CASE
    WHEN coa.normal_balance = 'debit' THEN COALESCE(SUM(jel.debit - jel.credit), 0)
    ELSE COALESCE(SUM(jel.credit - jel.debit), 0)
  END AS balance
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
WHERE coa.is_postable = TRUE
  AND coa.account_type IN ('asset', 'liability', 'equity')
GROUP BY coa.id, coa.code, coa.name_ar, coa.account_type, coa.normal_balance
UNION ALL
SELECT
  '3999' AS code,
  'صافي ربح / خسارة الفترة الحالية (مرحّل من قائمة الدخل)' AS name_ar,
  'equity'::account_type_enum AS section,
  current_period_profit AS balance
FROM net_profit
ORDER BY code;

-- 4) دفتر الأستاذ العام لحساب محدد خلال فترة مع الرصيد المتحرك (General Ledger RPC)
CREATE OR REPLACE FUNCTION rpc_general_ledger(
  p_account_id UUID,
  p_date_from  DATE,
  p_date_to    DATE
) RETURNS TABLE (
  entry_date      DATE,
  entry_no        VARCHAR,
  source_ref_no   VARCHAR,
  description     TEXT,
  debit           NUMERIC,
  credit          NUMERIC,
  running_balance NUMERIC
) AS $$
DECLARE
  v_normal_side balance_side_enum;
  v_opening     NUMERIC(18, 4) := 0;
BEGIN
  SELECT normal_balance INTO v_normal_side FROM chart_of_accounts WHERE id = p_account_id;

  SELECT COALESCE(SUM(
    CASE WHEN v_normal_side = 'debit' THEN (jel.debit - jel.credit)
         ELSE (jel.credit - jel.debit) END
  ), 0) INTO v_opening
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id AND je.status = 'posted' AND je.entry_date < p_date_from;

  RETURN QUERY
  SELECT
    p_date_from,
    'OPENING'::VARCHAR,
    'OPEN'::VARCHAR,
    'رصيد أول المدة المرحّل'::TEXT,
    CASE WHEN v_opening > 0 AND v_normal_side = 'debit' THEN v_opening ELSE 0 END,
    CASE WHEN v_opening > 0 AND v_normal_side = 'credit' THEN v_opening ELSE 0 END,
    v_opening
  UNION ALL
  SELECT
    je.entry_date,
    je.entry_no,
    je.source_ref_no,
    COALESCE(jel.line_memo, je.description),
    jel.debit,
    jel.credit,
    v_opening + SUM(
      CASE WHEN v_normal_side = 'debit' THEN (jel.debit - jel.credit)
           ELSE (jel.credit - jel.debit) END
    ) OVER (ORDER BY je.entry_date, je.created_at, jel.id)
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id
  WHERE jel.account_id = p_account_id
    AND je.status = 'posted'
    AND je.entry_date BETWEEN p_date_from AND p_date_to
  ORDER BY 1, 2;
END;
$$ LANGUAGE plpgsql STABLE;`,
    explanationPoints: [
      {
        label: 'توازن الميزانية العمومية التلقائي (vw_balance_sheet)',
        detail: 'يتم ترحيل صافي ربح أو خسارة الفترة من حسابات الإيرادات والمصروفات كسطر ضمن حقوق الملكية، مما يضمن تساوي الأصول مع (الالتزامات + حقوق الملكية) في أي لحظة.',
      },
      {
        label: 'دوال النوافذ للرصيد المتحرك (Window Functions)',
        detail: 'تستخدم دالة rpc_general_ledger تعليمة SUM(...) OVER لحساب الرصيد المتحرك لحظة بلحظة بعد رصيد أول المدة.',
      },
    ],
  },
  {
    id: 'inventory_reports_sql',
    phase: 5,
    shortLabel: 'تقارير المخزون (كاردكس/راكدة)',
    titleAr: '19. تقارير المخزون: كاردكس الصنف، أرصدة المستودعات، والأصناف الراكدة',
    subtitleAr: 'تتبع حركة الصنف بالوحدة الأساسية، التقييم المالي للمخزون، وكشف رأس المال المجمد في الأصناف الراكدة',
    code: `-- ============================================================================
-- تقارير المخزون: كاردكس الصنف + أرصدة المستودعات + الأصناف الراكدة
-- ============================================================================

-- 1) كاردكس الصنف التفصيلي (Item Cardex / Bin Card)
CREATE OR REPLACE FUNCTION rpc_item_cardex(
  p_item_id      UUID,
  p_warehouse_id UUID DEFAULT NULL,
  p_date_from    DATE DEFAULT '2026-01-01',
  p_date_to      DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  movement_date   DATE,
  warehouse_name  VARCHAR,
  movement_type   stock_movement_enum,
  source_ref_no   VARCHAR,
  qty_in          NUMERIC,
  qty_out         NUMERIC,
  running_qty     NUMERIC,
  unit_cost       NUMERIC,
  notes           TEXT
) AS $$
DECLARE
  v_opening_qty NUMERIC(18, 4) := 0;
BEGIN
  SELECT COALESCE(SUM(sm.qty_delta), 0) INTO v_opening_qty
  FROM stock_movements sm
  WHERE sm.item_id = p_item_id
    AND (p_warehouse_id IS NULL OR sm.warehouse_id = p_warehouse_id)
    AND sm.movement_date < p_date_from;

  RETURN QUERY
  SELECT
    sm.movement_date,
    w.name_ar,
    sm.movement_type,
    sm.source_ref_no,
    GREATEST(sm.qty_delta, 0) AS qty_in,
    GREATEST(-sm.qty_delta, 0) AS qty_out,
    v_opening_qty + SUM(sm.qty_delta) OVER (ORDER BY sm.movement_date, sm.created_at, sm.id) AS running_qty,
    sm.unit_cost,
    sm.notes
  FROM stock_movements sm
  JOIN warehouses w ON w.id = sm.warehouse_id
  WHERE sm.item_id = p_item_id
    AND (p_warehouse_id IS NULL OR sm.warehouse_id = p_warehouse_id)
    AND sm.movement_date BETWEEN p_date_from AND p_date_to
  ORDER BY sm.movement_date, sm.created_at, sm.id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2) تقرير أرصدة المستودعات والتقييم المالي الحالي
CREATE OR REPLACE VIEW vw_warehouse_stock_valuation AS
SELECT
  w.code AS warehouse_code,
  w.name_ar AS warehouse_name,
  i.sku,
  i.name_ar AS item_name,
  u.name_ar AS base_unit,
  ws.quantity_on_hand,
  i.cost_price AS wac_cost,
  ROUND(ws.quantity_on_hand * i.cost_price, 2) AS total_stock_value,
  i.min_stock_level,
  (ws.quantity_on_hand <= i.min_stock_level) AS is_low_stock
FROM warehouse_stocks ws
JOIN warehouses w ON w.id = ws.warehouse_id
JOIN items i ON i.id = ws.item_id
JOIN units u ON u.id = i.base_unit_id
ORDER BY w.code, i.sku;

-- 3) تقرير الأصناف الراكدة (Stagnant / Slow-Moving Inventory Report)
CREATE OR REPLACE FUNCTION rpc_stagnant_items(
  p_stagnant_days INT DEFAULT 60
) RETURNS TABLE (
  item_id           UUID,
  sku               VARCHAR,
  item_name         VARCHAR,
  total_qty_on_hand NUMERIC,
  wac_cost          NUMERIC,
  tied_up_capital   NUMERIC,
  last_sale_date    DATE,
  days_since_sale   INT
) AS $$
BEGIN
  RETURN QUERY
  WITH last_sales AS (
    SELECT sm.item_id, MAX(sm.movement_date) AS max_sale_date
    FROM stock_movements sm
    WHERE sm.movement_type = 'sale_out'
    GROUP BY sm.item_id
  )
  SELECT
    i.id,
    i.sku,
    i.name_ar,
    COALESCE(SUM(ws.quantity_on_hand), 0) AS total_qty_on_hand,
    i.cost_price,
    ROUND(COALESCE(SUM(ws.quantity_on_hand), 0) * i.cost_price, 2) AS tied_up_capital,
    ls.max_sale_date,
    COALESCE((CURRENT_DATE - ls.max_sale_date), 999) AS days_since_sale
  FROM items i
  JOIN warehouse_stocks ws ON ws.item_id = i.id
  LEFT JOIN last_sales ls ON ls.item_id = i.id
  WHERE i.item_type = 'stock'
  GROUP BY i.id, i.sku, i.name_ar, i.cost_price, ls.max_sale_date
  HAVING COALESCE(SUM(ws.quantity_on_hand), 0) > 0
     AND (ls.max_sale_date IS NULL OR (CURRENT_DATE - ls.max_sale_date) >= p_stagnant_days)
  ORDER BY tied_up_capital DESC;
END;
$$ LANGUAGE plpgsql STABLE;`,
    explanationPoints: [
      {
        label: 'كاردكس الصنف بالرصيد التراكمي',
        detail: 'يجمع بين الوارد والمنصرف والتسويات الجردية لمستودع محدد أو لجميع المستودعات مع حساب الرصيد التراكمي بعد كل مستند.',
      },
      {
        label: 'تحليل رأس المال المجمد للأصناف الراكدة',
        detail: 'يكشف الأصناف المتوفرة في المخزن التي لم تُبع خلال آخر 30/60/90 يوماً مرتبة تنازلياً حسب القيمة المالية المجمدة.',
      },
    ],
  },
  {
    id: 'party_reports_sql',
    phase: 5,
    shortLabel: 'كشوف العملاء والموردين وأعمار الديون',
    titleAr: '20. تقارير العملاء والموردين: كشف الحساب التفصيلي وأعمار الديون (Aging)',
    subtitleAr: 'دمج الفواتير والمرتجعات وسندات القبض والصرف في كشف حساب واحد وتوزيع المديونيات على فترات الاستحقاق',
    code: `-- ============================================================================
-- تقارير العملاء والموردين: كشف الحساب التفصيلي وأعمار الديون (Aging)
-- ============================================================================

-- 1) كشف حساب تفصيلي لعميل أو مورد بالرصيد المتحرك
CREATE OR REPLACE FUNCTION rpc_party_statement(
  p_party_type VARCHAR, -- 'customer' | 'supplier'
  p_party_id   UUID,
  p_date_from  DATE DEFAULT '2026-01-01',
  p_date_to    DATE DEFAULT CURRENT_DATE
) RETURNS TABLE (
  tx_date         DATE,
  doc_no          VARCHAR,
  doc_type        TEXT,
  description     TEXT,
  debit           NUMERIC,
  credit          NUMERIC,
  running_balance NUMERIC
) AS $$
BEGIN
  IF p_party_type = 'customer' THEN
    RETURN QUERY
    WITH txs AS (
      SELECT si.invoice_date AS d, si.invoice_no AS doc,
             CASE WHEN si.invoice_type = 'sale' THEN 'فاتورة مبيعات' ELSE 'مرتجع مبيعات' END AS tp,
             COALESCE(si.notes, si.invoice_no) AS descr,
             CASE WHEN si.invoice_type = 'sale' THEN si.total_amount ELSE 0 END AS dr,
             CASE WHEN si.invoice_type = 'sales_return' THEN si.total_amount ELSE 0 END AS cr,
             si.created_at AS ts
      FROM sales_invoices si
      WHERE si.customer_id = p_party_id AND si.payment_mode = 'credit'
      UNION ALL
      SELECT v.voucher_date, v.voucher_no,
             CASE WHEN v.voucher_type = 'receipt' THEN 'سند قبض' ELSE 'سند صرف' END,
             v.description,
             CASE WHEN v.voucher_type = 'payment' THEN v.amount ELSE 0 END,
             CASE WHEN v.voucher_type = 'receipt' THEN v.amount ELSE 0 END,
             v.created_at
      FROM vouchers v
      WHERE v.customer_id = p_party_id
    )
    SELECT d, doc, tp, descr, dr, cr,
           SUM(dr - cr) OVER (ORDER BY d, ts, doc) AS running_balance
    FROM txs
    WHERE d BETWEEN p_date_from AND p_date_to
    ORDER BY d, ts, doc;
  ELSE
    RETURN QUERY
    WITH txs AS (
      SELECT pi.invoice_date AS d, pi.invoice_no AS doc,
             CASE WHEN pi.invoice_type = 'purchase' THEN 'فاتورة مشتريات' ELSE 'مرتجع مشتريات' END AS tp,
             COALESCE(pi.notes, pi.invoice_no) AS descr,
             CASE WHEN pi.invoice_type = 'purchase_return' THEN pi.total_amount ELSE 0 END AS dr,
             CASE WHEN pi.invoice_type = 'purchase' THEN pi.total_amount ELSE 0 END AS cr,
             pi.created_at AS ts
      FROM purchase_invoices pi
      WHERE pi.supplier_id = p_party_id AND pi.payment_mode = 'credit'
      UNION ALL
      SELECT v.voucher_date, v.voucher_no,
             CASE WHEN v.voucher_type = 'payment' THEN 'سند صرف' ELSE 'سند قبض' END,
             v.description,
             CASE WHEN v.voucher_type = 'payment' THEN v.amount ELSE 0 END,
             CASE WHEN v.voucher_type = 'receipt' THEN v.amount ELSE 0 END,
             v.created_at
      FROM vouchers v
      WHERE v.supplier_id = p_party_id
    )
    SELECT d, doc, tp, descr, dr, cr,
           SUM(cr - dr) OVER (ORDER BY d, ts, doc) AS running_balance
    FROM txs
    WHERE d BETWEEN p_date_from AND p_date_to
    ORDER BY d, ts, doc;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2) تقرير أعمار الديون للعملاء والموردين (AR & AP Aging Report)
CREATE OR REPLACE VIEW vw_ar_aging AS
SELECT
  c.id AS customer_id,
  c.code,
  c.name_ar,
  c.credit_limit,
  c.current_balance,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - si.invoice_date) BETWEEN 0 AND 30 THEN si.total_amount ELSE 0 END), 0) AS bucket_0_30,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - si.invoice_date) BETWEEN 31 AND 60 THEN si.total_amount ELSE 0 END), 0) AS bucket_31_60,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - si.invoice_date) BETWEEN 61 AND 90 THEN si.total_amount ELSE 0 END), 0) AS bucket_61_90,
  COALESCE(SUM(CASE WHEN (CURRENT_DATE - si.invoice_date) > 90 THEN si.total_amount ELSE 0 END), 0) AS bucket_90_plus
FROM customers c
LEFT JOIN sales_invoices si
  ON si.customer_id = c.id AND si.invoice_type = 'sale' AND si.payment_mode = 'credit'
GROUP BY c.id, c.code, c.name_ar, c.credit_limit, c.current_balance
ORDER BY c.current_balance DESC;`,
    explanationPoints: [
      {
        label: 'كشف حساب موحد للفواتير والسندات',
        detail: 'يربط فواتير المبيعات/المشتريات الآجلة مع سندات القبض/الصرف ليعرض للعميل أو المورد رصيداً تراكمياً دقيقاً بعد كل حركة.',
      },
      {
        label: 'شرائح أعمار الديون (0-30، 31-60، 61-90، +90 يوم)',
        detail: 'تصنف المديونيات حسب تاريخ استحقاق الفواتير لمساعدة الإدارة المالية في التحصيل وتقليل الديون المتعثرة.',
      },
    ],
  },
  {
    id: 'partner_reports_sql',
    phase: 5,
    shortLabel: 'تقارير جاري الشركاء والأرباح',
    titleAr: '21. تقارير جاري الشركاء وتوزيع الأرباح (Partners Current & Profit Share)',
    subtitleAr: 'حساب صافي ربح الشركة من قائمة الدخل وتوزيعه حسب نسب الملكية ودمجه مع مسحوبات وإيداعات الشركاء',
    code: `-- ============================================================================
-- تقارير جاري الشركاء وتوزيع أرباح الفترة (Partners Equity & Profit Report)
-- ============================================================================
CREATE OR REPLACE VIEW vw_partners_profit_report AS
WITH company_profit AS (
  SELECT COALESCE(SUM(
    CASE
      WHEN coa.account_type = 'revenue' THEN (jel.credit - jel.debit)
      WHEN coa.account_type = 'expense' THEN -(jel.debit - jel.credit)
      ELSE 0
    END
  ), 0) AS net_income
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
  JOIN chart_of_accounts coa ON coa.id = jel.account_id
),
partner_ledger AS (
  SELECT
    partner_id,
    COALESCE(SUM(CASE WHEN transaction_type = 'drawing' THEN amount ELSE 0 END), 0) AS total_drawings,
    COALESCE(SUM(CASE WHEN transaction_type IN ('profit_share', 'loan_to_company', 'capital_injection') THEN amount ELSE 0 END), 0) AS total_credits,
    COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0) AS net_current_balance
  FROM partner_current_accounts
  GROUP BY partner_id
)
SELECT
  p.id AS partner_id,
  p.code,
  p.name_ar,
  p.ownership_percent,
  p.capital_contribution,
  COALESCE(pl.total_credits, 0) AS current_credits,
  COALESCE(pl.total_drawings, 0) AS total_drawings,
  COALESCE(pl.net_current_balance, 0) AS net_current_balance,
  ROUND((cp.net_income * p.ownership_percent / 100.0), 2) AS period_profit_share,
  ROUND(
    p.capital_contribution
    + COALESCE(pl.net_current_balance, 0)
    + (cp.net_income * p.ownership_percent / 100.0),
    2
  ) AS total_partner_equity
FROM partners p
CROSS JOIN company_profit cp
LEFT JOIN partner_ledger pl ON pl.partner_id = p.id
WHERE p.is_active = TRUE
ORDER BY p.ownership_percent DESC;`,
    explanationPoints: [
      {
        label: 'التوزيع التلقائي لصافي ربح الفترة',
        detail: 'يستخرج التقرير صافي ربح قائمة الدخل لحظياً ويضربه في نسبة ملكية كل شريك ليظهر نصيبه المتوقع من الأرباح.',
      },
      {
        label: 'صافي حقوق الشريك الشاملة',
        detail: 'يجمع بين رأس المال المدفوع + صافي رصيد جاري الشريك (الإيداعات والأرباح المرحلة - المسحوبات) + حصة الشريك من ربح الفترة الجارية.',
      },
    ],
  },
];

export const FULL_SQL_SCRIPT = SQL_SECTIONS.map((s) => s.code).join('\n\n');
