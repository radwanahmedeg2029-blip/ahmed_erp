import { useState } from 'react';
import { ArrowLeftRight, KeyRound, Link2 } from 'lucide-react';

interface TableColumn {
  name: string;
  type: string;
  key?: 'PK' | 'FK' | 'UQ';
  ref?: string;
}

interface TableSchemaNode {
  id: string;
  phase: 1 | 2;
  name: string;
  titleAr: string;
  descriptionAr: string;
  columns: TableColumn[];
}

interface ForeignKeyRelation {
  id: string;
  phase: 1 | 2;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  onDelete: string;
  cardinality: string;
  summaryAr: string;
}

const SCHEMA_TABLES: TableSchemaNode[] = [
  {
    id: 'chart_of_accounts',
    phase: 1,
    name: 'chart_of_accounts',
    titleAr: 'شجرة الحسابات الهرمية',
    descriptionAr: 'الحسابات الخمسة الرئيسية والفرعية عبر الربط الذاتي parent_id.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(30)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(150)' },
      { name: 'account_type', type: 'ENUM' },
      { name: 'parent_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
      { name: 'is_postable', type: 'BOOLEAN' },
    ],
  },
  {
    id: 'warehouses',
    phase: 1,
    name: 'warehouses',
    titleAr: 'المستودعات',
    descriptionAr: 'المخازن والفروع مرتبطة بحساب المخزون الخاص بها في الشجرة.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(20)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(120)' },
      { name: 'inventory_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
      { name: 'is_default', type: 'BOOLEAN' },
    ],
  },
  {
    id: 'units',
    phase: 1,
    name: 'units',
    titleAr: 'الوحدات ومعامل التحويل',
    descriptionAr: 'الوحدات الأساسية والفرعية مع معامل التحويل بدقة 6 خانات عشرية.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(20)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(60)' },
      { name: 'base_unit_id', type: 'UUID', key: 'FK', ref: 'units.id' },
      { name: 'conversion_factor', type: 'NUMERIC(18,6)' },
    ],
  },
  {
    id: 'items',
    phase: 1,
    name: 'items',
    titleAr: 'الأصناف والباركود',
    descriptionAr: 'المنتجات والخدمات، الباركود، التكلفة، والربط بالوحدات والمستودع والحسابات.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'sku', type: 'VARCHAR(50)', key: 'UQ' },
      { name: 'barcode', type: 'VARCHAR(64)', key: 'UQ' },
      { name: 'base_unit_id', type: 'UUID', key: 'FK', ref: 'units.id' },
      { name: 'default_warehouse_id', type: 'UUID', key: 'FK', ref: 'warehouses.id' },
      { name: 'cost_price', type: 'NUMERIC(18,4)' },
      { name: 'inventory_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
    ],
  },
  {
    id: 'customers',
    phase: 2,
    name: 'customers',
    titleAr: 'العملاء والحد الائتماني',
    descriptionAr: 'تصنيف زوايا العملاء والرقابة على السقف الائتماني وذمم العملاء.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(30)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(150)' },
      { name: 'customer_tier', type: 'customer_tier_enum' },
      { name: 'credit_limit', type: 'NUMERIC(18,4)' },
      { name: 'receivable_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
      { name: 'default_warehouse_id', type: 'UUID', key: 'FK', ref: 'warehouses.id' },
    ],
  },
  {
    id: 'suppliers',
    phase: 2,
    name: 'suppliers',
    titleAr: 'الموردين',
    descriptionAr: 'بيانات الموردين وشروط السداد وربطها بحساب الدائنين.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(30)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(150)' },
      { name: 'payment_terms_days', type: 'SMALLINT' },
      { name: 'payable_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
    ],
  },
  {
    id: 'employees',
    phase: 2,
    name: 'employees',
    titleAr: 'الموظفين',
    descriptionAr: 'الرواتب والبدلات وربط الموظف بالمستودع وحساب الرواتب والسلف.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'employee_code', type: 'VARCHAR(30)', key: 'UQ' },
      { name: 'full_name_ar', type: 'VARCHAR(150)' },
      { name: 'basic_salary', type: 'NUMERIC(18,4)' },
      { name: 'warehouse_id', type: 'UUID', key: 'FK', ref: 'warehouses.id' },
      { name: 'salary_expense_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
      { name: 'advance_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
    ],
  },
  {
    id: 'partners',
    phase: 2,
    name: 'partners',
    titleAr: 'الشركاء',
    descriptionAr: 'نسب الملكية وحصة رأس المال وحسابات رأس المال والجاري.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(30)', key: 'UQ' },
      { name: 'name_ar', type: 'VARCHAR(150)' },
      { name: 'ownership_percent', type: 'NUMERIC(5,2)' },
      { name: 'capital_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
      { name: 'current_account_id', type: 'UUID', key: 'FK', ref: 'chart_of_accounts.id' },
    ],
  },
  {
    id: 'partner_current_accounts',
    phase: 2,
    name: 'partner_current_accounts',
    titleAr: 'حركات جاري الشركاء',
    descriptionAr: 'دفتر مسحوبات وأرباح وإيداعات الشركاء مع توثيق منشئ الحركة.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'partner_id', type: 'UUID', key: 'FK', ref: 'partners.id' },
      { name: 'transaction_type', type: 'partner_tx_type_enum' },
      { name: 'direction', type: 'balance_side_enum' },
      { name: 'amount', type: 'NUMERIC(18,4)' },
      { name: 'created_by', type: 'UUID', key: 'FK', ref: 'app_users.id' },
    ],
  },
  {
    id: 'roles',
    phase: 2,
    name: 'roles & role_permissions',
    titleAr: 'الأدوار ومصفوفة الصلاحيات',
    descriptionAr: 'تحديد أذونات العرض والإنشاء والتعديل والحذف والاعتماد لكل موديول.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'code', type: 'VARCHAR(40)', key: 'UQ' },
      { name: 'role_id', type: 'UUID', key: 'FK', ref: 'roles.id' },
      { name: 'module_key', type: 'erp_module_enum' },
      { name: 'can_view / create / edit / delete / approve', type: 'BOOLEAN' },
    ],
  },
  {
    id: 'app_users',
    phase: 2,
    name: 'app_users',
    titleAr: 'المستخدمين',
    descriptionAr: 'مستخدمو النظام المرتبطون بالدور الوظيفي وسجل الموظف والمستودع الافتراضي.',
    columns: [
      { name: 'id', type: 'UUID', key: 'PK' },
      { name: 'username', type: 'VARCHAR(60)', key: 'UQ' },
      { name: 'role_id', type: 'UUID', key: 'FK', ref: 'roles.id' },
      { name: 'employee_id', type: 'UUID', key: 'FK', ref: 'employees.id' },
      { name: 'default_warehouse_id', type: 'UUID', key: 'FK', ref: 'warehouses.id' },
    ],
  },
];

const RELATIONS: ForeignKeyRelation[] = [
  {
    id: 'rel-cust-coa',
    phase: 2,
    fromTable: 'customers',
    fromColumn: 'receivable_account_id',
    toTable: 'chart_of_accounts',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يربط كل عميل بحساب الذمم المدينة في شجرة الحسابات لتتبع المديونيات والحد الائتماني آلياً.',
  },
  {
    id: 'rel-sup-coa',
    phase: 2,
    fromTable: 'suppliers',
    fromColumn: 'payable_account_id',
    toTable: 'chart_of_accounts',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يربط المورد بحساب الموردين الدائنين لتسجيل التزامات فواتير المشتريات.',
  },
  {
    id: 'rel-emp-wh-coa',
    phase: 2,
    fromTable: 'employees',
    fromColumn: 'warehouse_id / salary_expense_account_id',
    toTable: 'chart_of_accounts',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يربط الموظف بالفرع/المستودع وبحسابي مصروف الرواتب وسلف الموظفين.',
  },
  {
    id: 'rel-prt-tx',
    phase: 2,
    fromTable: 'partner_current_accounts',
    fromColumn: 'partner_id',
    toTable: 'partners',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يربط جميع حركات المسحوبات والأرباح والإيداعات بسجل الشريك ويمنع حذف شريك لديه حركات.',
  },
  {
    id: 'rel-user-role-emp',
    phase: 2,
    fromTable: 'app_users',
    fromColumn: 'role_id / employee_id',
    toTable: 'roles',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يحدد صلاحيات المستخدم عبر دوره الوظيفي ويربطه اختيارياً بسجل الموظف.',
  },
  {
    id: 'rel-coa-self',
    phase: 1,
    fromTable: 'chart_of_accounts',
    fromColumn: 'parent_id',
    toTable: 'chart_of_accounts',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1 (ربط ذاتي)',
    summaryAr: 'يبني الهيكل الشجري الهرمي للحسابات الخمسة الرئيسية والفرعية.',
  },
  {
    id: 'rel-items-units',
    phase: 1,
    fromTable: 'items',
    fromColumn: 'base_unit_id / purchase_unit_id',
    toTable: 'units',
    toColumn: 'id',
    onDelete: 'RESTRICT',
    cardinality: 'N : 1',
    summaryAr: 'يربط الصنف بوحدة الجرد الأساسية ووحدة الشراء ومعاملات التحويل.',
  },
];

export function ErdDiagramView() {
  const [phaseFilter, setPhaseFilter] = useState<'all' | 1 | 2>('all');
  const [activeRelId, setActiveRelId] = useState<string>(RELATIONS[0].id);

  const visibleTables =
    phaseFilter === 'all'
      ? SCHEMA_TABLES
      : SCHEMA_TABLES.filter((t) => t.phase === phaseFilter);

  const visibleRelations =
    phaseFilter === 'all'
      ? RELATIONS
      : RELATIONS.filter((r) => r.phase === phaseFilter);

  const activeRel =
    RELATIONS.find((r) => r.id === activeRelId) ?? visibleRelations[0] ?? RELATIONS[0];

  const isHighlightedTable = (tableId: string) =>
    activeRel.fromTable === tableId || activeRel.toTable === tableId;

  return (
    <div className="space-y-6">
      {/* Interactive Relation Selector Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              خريطة العلاقات والمفاتيح الأجنبية (11 جدولاً — المرحلتين 1 و 2)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              اختر المرحلة أو اضغط على أي علاقة لمعاينة الجداول المرتبطة وسياسة الحذف المرجعية.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto">
            {(
              [
                { id: 'all', label: 'جميع الجداول (11)' },
                { id: 1, label: 'المرحلة 1 (4)' },
                { id: 2, label: 'المرحلة 2 (7)' },
              ] as const
            ).map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                onClick={() => setPhaseFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  phaseFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-4">
          {visibleRelations.map((rel) => {
            const active = rel.id === activeRel.id;
            return (
              <button
                key={rel.id}
                type="button"
                onClick={() => setActiveRelId(rel.id)}
                className={`text-right p-3 rounded-lg border transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-mono" dir="ltr">
                  <span className="font-semibold text-slate-900 truncate">{rel.fromTable}</span>
                  <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold text-emerald-700 truncate">{rel.toTable}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 font-mono truncate" dir="ltr">
                  FK: {rel.fromColumn} → {rel.toColumn}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Relation Explanation Banner */}
        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-semibold text-slate-900">
                <span className="font-mono" dir="ltr">
                  {activeRel.fromTable}.{activeRel.fromColumn}
                </span>{' '}
                ←{' '}
                <span className="font-mono text-emerald-700" dir="ltr">
                  {activeRel.toTable}.{activeRel.toColumn}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeRel.summaryAr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600 shrink-0 font-mono">
            <span>{activeRel.cardinality}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-slate-900">ON DELETE {activeRel.onDelete}</span>
          </div>
        </div>
      </div>

      {/* Tables Schema Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleTables.map((table) => {
          const highlighted = isHighlightedTable(table.id);
          return (
            <div
              key={table.id}
              className={`bg-white rounded-xl border transition-colors overflow-hidden ${
                highlighted ? 'border-emerald-600 ring-1 ring-emerald-600/20' : 'border-slate-200'
              }`}
            >
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
                <div>
                  <div className="text-[11px] text-slate-500">المرحلة {table.phase}</div>
                  <h3 className="text-sm font-semibold text-slate-900">{table.titleAr}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{table.descriptionAr}</p>
                </div>
                <span className="text-xs font-mono font-semibold text-slate-700 shrink-0" dir="ltr">
                  {table.name}
                </span>
              </div>

              <div className="divide-y divide-slate-100" dir="ltr">
                {table.columns.map((col) => (
                  <div
                    key={col.name}
                    className="px-5 py-2.5 flex items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {col.key ? (
                        <span
                          className={`inline-flex items-center gap-1 w-9 shrink-0 font-semibold ${
                            col.key === 'PK'
                              ? 'text-amber-700'
                              : col.key === 'FK'
                              ? 'text-emerald-700'
                              : 'text-slate-500'
                          }`}
                        >
                          <KeyRound className="w-3 h-3" />
                          {col.key}
                        </span>
                      ) : (
                        <span className="w-9 shrink-0 text-slate-300">—</span>
                      )}
                      <span className="text-slate-900 font-medium truncate">{col.name}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-slate-500">
                      {col.ref && (
                        <span className="text-[11px] text-emerald-700 hidden sm:inline">
                          → {col.ref}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">{col.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
