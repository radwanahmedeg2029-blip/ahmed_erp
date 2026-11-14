/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Copy,
  Database,
  Download,
  FileCode2,
  FileSpreadsheet,
  FolderTree,
  LayoutDashboard,
  Menu,
  Package,
  PieChart,
  Receipt,
  Scale,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserCheck,
  Users,
  Wallet,
  Warehouse as WarehouseIcon,
  X,
} from 'lucide-react';
import { ChartOfAccountsView } from './components/ChartOfAccountsView';
import { CustomersView } from './components/CustomersView';
import { DashboardSummaryView } from './components/DashboardSummaryView';
import { EmployeesView } from './components/EmployeesView';
import { ErdDiagramView } from './components/ErdDiagramView';
import { ExpensesRevenuesView } from './components/ExpensesRevenuesView';
import { FinancialReportsView } from './components/FinancialReportsView';
import { InventoryAdjustmentsView } from './components/InventoryAdjustmentsView';
import { InventoryReportsView } from './components/InventoryReportsView';
import { ItemsView } from './components/ItemsView';
import { JournalEntriesView } from './components/JournalEntriesView';
import { PartnerReportsView } from './components/PartnerReportsView';
import { PartnersView } from './components/PartnersView';
import { PartyReportsView } from './components/PartyReportsView';
import { PurchasesView } from './components/PurchasesView';
import { SalesView } from './components/SalesView';
import { SqlSchemaView } from './components/SqlSchemaView';
import { SuppliersView } from './components/SuppliersView';
import { UnitsView } from './components/UnitsView';
import { UsersRolesView } from './components/UsersRolesView';
import { VouchersView } from './components/VouchersView';
import { WarehousesView } from './components/WarehousesView';
import {
  ERP_MODULES,
  INITIAL_ADJUSTMENTS,
  INITIAL_CUSTOMERS,
  INITIAL_EMPLOYEES,
  INITIAL_FINANCIAL_OPS,
  INITIAL_ITEMS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_PARTNERS,
  INITIAL_PARTNER_TXS,
  INITIAL_PURCHASE_INVOICES,
  INITIAL_ROLES,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SALES_INVOICES,
  INITIAL_SUPPLIERS,
  INITIAL_UNITS,
  INITIAL_USERS,
  INITIAL_VOUCHERS,
  INITIAL_WAREHOUSES,
  INITIAL_WAREHOUSE_STOCKS,
  RAW_INITIAL_ACCOUNTS,
  recalculateChartBalances,
} from './data/initialErpData';
import { FULL_SQL_SCRIPT } from './data/sqlSchema';
import {
  ActiveTab,
  AdjustmentReason,
  AppUser,
  ChartAccount,
  Customer,
  Employee,
  ErpModuleKey,
  FinancialOpCategory,
  FinancialOperation,
  InventoryAdjustment,
  InventoryAdjustmentLine,
  InvoiceLine,
  InvoicePaymentMode,
  Item,
  JournalEntry,
  JournalEntryLine,
  Partner,
  PartnerCurrentTx,
  PaymentMethod,
  PurchaseInvoice,
  PurchaseInvoiceType,
  Role,
  RolePermission,
  SalesInvoice,
  SalesInvoiceType,
  Supplier,
  Unit,
  Voucher,
  VoucherPartyType,
  VoucherType,
  Warehouse,
  WarehouseStock,
} from './types/erp';

interface NavItem {
  id: ActiveTab;
  group: 'overview' | 'phase5' | 'schema' | 'phase4' | 'phase3' | 'phase2' | 'phase1';
  label: string;
  subtitle: string;
  icon: typeof FileCode2;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    group: 'overview',
    label: 'لوحة التحكم والملخص المالي',
    subtitle: 'Sales vs Purchases · Inventory',
    icon: LayoutDashboard,
  },
  {
    id: 'financial_reports',
    group: 'phase5',
    label: 'التقارير المالية الختامية',
    subtitle: 'ميزان المراجعة · الدخل · الميزانية · الأستاذ',
    icon: BarChart3,
  },
  {
    id: 'inventory_reports',
    group: 'phase5',
    label: 'تقارير المخزون والكاردكس',
    subtitle: 'كاردكس الصنف · أرصدة · الأصناف الراكدة',
    icon: Boxes,
  },
  {
    id: 'party_reports',
    group: 'phase5',
    label: 'كشوف العملاء والموردين وأعمار الديون',
    subtitle: 'statement & AR/AP aging',
    icon: FileSpreadsheet,
  },
  {
    id: 'partner_reports',
    group: 'phase5',
    label: 'تقارير جاري الشركاء والأرباح',
    subtitle: 'partners equity & net profit',
    icon: PieChart,
  },
  {
    id: 'sales',
    group: 'phase4',
    label: 'فواتير ومرتجعات المبيعات',
    subtitle: 'sales_invoices & COGS',
    icon: ShoppingCart,
  },
  {
    id: 'purchases',
    group: 'phase4',
    label: 'فواتير ومرتجعات المشتريات',
    subtitle: 'purchase_invoices & WAC',
    icon: ShoppingBag,
  },
  {
    id: 'inventory_adjustments',
    group: 'phase4',
    label: 'أرصدة المخازن والتسويات الجردية',
    subtitle: 'warehouse_stocks & adjustments',
    icon: ClipboardCheck,
  },
  {
    id: 'sql',
    group: 'schema',
    label: 'كود SQL (Supabase)',
    subtitle: 'DDL + Triggers + RPCs',
    icon: FileCode2,
  },
  {
    id: 'erd',
    group: 'schema',
    label: 'مخطط العلاقات (ERD)',
    subtitle: 'الجداول والعلاقات',
    icon: Database,
  },
  {
    id: 'expenses_revenues',
    group: 'phase3',
    label: 'المصروفات والإيرادات',
    subtitle: 'financial_operations',
    icon: Wallet,
  },
  {
    id: 'vouchers',
    group: 'phase3',
    label: 'سندات القبض والصرف',
    subtitle: 'vouchers',
    icon: Receipt,
  },
  {
    id: 'journal_entries',
    group: 'phase3',
    label: 'قيود اليومية العامة',
    subtitle: 'journal_entries',
    icon: BookOpen,
  },
  {
    id: 'accounts',
    group: 'phase1',
    label: 'شجرة الحسابات (أرصدة حية)',
    subtitle: 'chart_of_accounts',
    icon: FolderTree,
  },
  {
    id: 'warehouses',
    group: 'phase1',
    label: 'المستودعات',
    subtitle: 'warehouses',
    icon: WarehouseIcon,
  },
  {
    id: 'units',
    group: 'phase1',
    label: 'الوحدات والتحويل',
    subtitle: 'units',
    icon: Scale,
  },
  {
    id: 'items',
    group: 'phase1',
    label: 'الأصناف والباركود',
    subtitle: 'items',
    icon: Package,
  },
  {
    id: 'customers',
    group: 'phase2',
    label: 'العملاء والحد الائتماني',
    subtitle: 'customers',
    icon: Users,
  },
  {
    id: 'suppliers',
    group: 'phase2',
    label: 'الموردين',
    subtitle: 'suppliers',
    icon: Truck,
  },
  {
    id: 'employees',
    group: 'phase2',
    label: 'الموظفين',
    subtitle: 'employees',
    icon: UserCheck,
  },
  {
    id: 'partners',
    group: 'phase2',
    label: 'الشركاء وجاري الشركاء',
    subtitle: 'partners & ledger',
    icon: Briefcase,
  },
  {
    id: 'users_roles',
    group: 'phase2',
    label: 'المستخدمين والصلاحيات',
    subtitle: 'roles & app_users',
    icon: Shield,
  },
];

const NAV_GROUPS: { key: NavItem['group']; title: string }[] = [
  { key: 'overview', title: 'الرئيسية · الملخص التنفيذي' },
  { key: 'phase5', title: 'المرحلة 5 · التقارير الختامية والتحليلية' },
  { key: 'phase4', title: 'المرحلة 4 · المبيعات والمشتريات والمخازن' },
  { key: 'phase3', title: 'المرحلة 3 · العمليات المالية والسندات' },
  { key: 'schema', title: 'البنية الهندسية (SQL & ERD)' },
  { key: 'phase1', title: 'المرحلة 1 · الحسابات والمخازن' },
  { key: 'phase2', title: 'المرحلة 2 · الأطراف والموارد البشرية' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copiedTop, setCopiedTop] = useState(false);
  const [exportedJson, setExportedJson] = useState(false);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);

  // Phase 1 State
  const [rawAccounts, setRawAccounts] = useState<ChartAccount[]>(RAW_INITIAL_ACCOUNTS);
  const [warehouses, setWarehouses] = useState<Warehouse[]>(INITIAL_WAREHOUSES);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);

  // Phase 2 State
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [partners, setPartners] = useState<Partner[]>(INITIAL_PARTNERS);
  const [partnerTxs, setPartnerTxs] = useState<PartnerCurrentTx[]>(INITIAL_PARTNER_TXS);
  const [roles, setRoles] = useState<Role[]>(INITIAL_ROLES);
  const [permissions, setPermissions] = useState<RolePermission[]>(INITIAL_ROLE_PERMISSIONS);
  const [users, setUsers] = useState<AppUser[]>(INITIAL_USERS);

  // Phase 3 State
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>(INITIAL_JOURNAL_ENTRIES);
  const [vouchers, setVouchers] = useState<Voucher[]>(INITIAL_VOUCHERS);
  const [financialOps, setFinancialOps] = useState<FinancialOperation[]>(INITIAL_FINANCIAL_OPS);

  // Phase 4 State
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>(
    INITIAL_WAREHOUSE_STOCKS
  );
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(
    INITIAL_PURCHASE_INVOICES
  );
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>(
    INITIAL_SALES_INVOICES
  );
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>(
    INITIAL_ADJUSTMENTS
  );

  // Live hierarchical Chart of Accounts derived automatically from all posted Journal Entries
  const accounts = useMemo(
    () => recalculateChartBalances(rawAccounts, journalEntries),
    [rawAccounts, journalEntries]
  );

  const cashBalanceTotal = useMemo(
    () => accounts.find((a) => a.code === '1101')?.currentBalance ?? 0,
    [accounts]
  );

  const inventoryBalanceTotal = useMemo(
    () => accounts.find((a) => a.code === '1103')?.currentBalance ?? 0,
    [accounts]
  );

  const activeNav = NAV_ITEMS.find((n) => n.id === activeTab) ?? NAV_ITEMS[0];

  const handleCopyAllSql = async () => {
    try {
      await navigator.clipboard.writeText(FULL_SQL_SCRIPT);
      setCopiedTop(true);
      setTimeout(() => setCopiedTop(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleExportJsonBackup = () => {
    const exportedAt = new Date().toISOString();
    const tables = {
      chartOfAccounts: accounts,
      rawChartOfAccounts: rawAccounts,
      warehouses,
      units,
      items,
      warehouseStocks,
      customers,
      suppliers,
      employees,
      partners,
      partnerTransactions: partnerTxs,
      roles,
      rolePermissions: permissions,
      appUsers: users,
      financialOperations: financialOps,
      vouchers,
      purchaseInvoices,
      salesInvoices,
      inventoryAdjustments: adjustments,
      journalEntries,
    };

    const backupPayload = {
      schemaVersion: '1.0.0',
      system: 'ميزان ERP',
      exportedAt,
      recordCounts: {
        chartOfAccounts: accounts.length,
        warehouses: warehouses.length,
        units: units.length,
        items: items.length,
        warehouseStocks: warehouseStocks.length,
        customers: customers.length,
        suppliers: suppliers.length,
        employees: employees.length,
        partners: partners.length,
        partnerTransactions: partnerTxs.length,
        roles: roles.length,
        rolePermissions: permissions.length,
        appUsers: users.length,
        financialOperations: financialOps.length,
        vouchers: vouchers.length,
        purchaseInvoices: purchaseInvoices.length,
        salesInvoices: salesInvoices.length,
        inventoryAdjustments: adjustments.length,
        journalEntries: journalEntries.length,
      },
      tables,
    };

    const jsonContent = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileStamp = exportedAt.slice(0, 19).replace(/[:T]/g, '-');
    link.href = url;
    link.download = `mizan-erp-backup-${fileStamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportedJson(true);
    setTimeout(() => setExportedJson(false), 2500);
  };

  // Phase 1 Handlers
  const handleAddAccount = (newAcc: Omit<ChartAccount, 'id'>) => {
    setRawAccounts((prev) => [...prev, { ...newAcc, id: `acc-${Date.now()}` }]);
  };

  const handleAddWarehouse = (newWh: Omit<Warehouse, 'id'>) => {
    const id = `wh-${Date.now()}`;
    setWarehouses((prev) => {
      const cleaned = newWh.isDefault
        ? prev.map((w) => ({ ...w, isDefault: false }))
        : prev;
      return [...cleaned, { ...newWh, id }];
    });
  };

  const handleSetDefaultWarehouse = (id: string) => {
    setWarehouses((prev) => prev.map((w) => ({ ...w, isDefault: w.id === id })));
  };

  const handleAddUnit = (newUnit: Omit<Unit, 'id'>) => {
    setUnits((prev) => [...prev, { ...newUnit, id: `unit-${Date.now()}` }]);
  };

  const handleAddItem = (newItem: Omit<Item, 'id'>) => {
    setItems((prev) => [...prev, { ...newItem, id: `item-${Date.now()}` }]);
  };

  // Phase 2 Handlers
  const handleAddCustomer = (newCust: Omit<Customer, 'id'>) => {
    setCustomers((prev) => [...prev, { ...newCust, id: `cust-${Date.now()}` }]);
  };

  const handleAddSupplier = (newSup: Omit<Supplier, 'id'>) => {
    setSuppliers((prev) => [...prev, { ...newSup, id: `sup-${Date.now()}` }]);
  };

  const handleAddEmployee = (newEmp: Omit<Employee, 'id'>) => {
    setEmployees((prev) => [...prev, { ...newEmp, id: `emp-${Date.now()}` }]);
  };

  const handleAddPartner = (newPartner: Omit<Partner, 'id'>) => {
    setPartners((prev) => [...prev, { ...newPartner, id: `prt-${Date.now()}` }]);
  };

  const handleAddPartnerTx = (newTx: Omit<PartnerCurrentTx, 'id'>) => {
    setPartnerTxs((prev) => [...prev, { ...newTx, id: `ptx-${Date.now()}` }]);
  };

  const handleTogglePermission = (
    roleId: string,
    moduleKey: ErpModuleKey,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove'
  ) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.roleId === roleId && p.moduleKey === moduleKey
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
  };

  const handleAddRole = (newRole: Omit<Role, 'id'>) => {
    const roleId = `role-${Date.now()}`;
    setRoles((prev) => [...prev, { ...newRole, id: roleId }]);
    setPermissions((prev) => [
      ...prev,
      ...ERP_MODULES.map((m) => ({
        id: `perm-${roleId}-${m.key}`,
        roleId,
        moduleKey: m.key,
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
      })),
    ]);
  };

  const handleAddUser = (newUser: Omit<AppUser, 'id'>) => {
    setUsers((prev) => [...prev, { ...newUser, id: `usr-${Date.now()}` }]);
  };

  const handleToggleUserActive = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
  };

  // Phase 3 Atomic Handlers (Auto-generating Journal Entries + Updating COA Tree)
  const handlePostManualEntry = (payload: {
    entryDate: string;
    description: string;
    lines: Omit<JournalEntryLine, 'id'>[];
  }) => {
    const nextNum = journalEntries.length + 1;
    const entryNo = `JV-2026-${String(nextNum).padStart(4, '0')}`;
    const entryId = `je-${Date.now()}`;
    const newEntry: JournalEntry = {
      id: entryId,
      entryNo,
      entryDate: payload.entryDate,
      sourceType: 'manual',
      sourceRefNo: entryNo,
      description: payload.description,
      status: 'posted',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lines: payload.lines.map((l, idx) => ({
        ...l,
        id: `jel-${Date.now()}-${idx}`,
      })),
    };
    setJournalEntries((prev) => [...prev, newEntry]);
  };

  const handlePostVoucher = (payload: {
    voucherType: VoucherType;
    voucherDate: string;
    paymentMethod: PaymentMethod;
    cashBankAccountId: string;
    counterAccountId: string;
    partyType: VoucherPartyType;
    partyId: string | null;
    partyLabel: string;
    amount: number;
    referenceNo: string;
    description: string;
  }) => {
    const prefix = payload.voucherType === 'receipt' ? 'RV' : 'PV';
    const countOfType =
      vouchers.filter((v) => v.voucherType === payload.voucherType).length + 1;
    const voucherNo = `${prefix}-2026-${String(countOfType).padStart(4, '0')}`;

    const entryNo = `JV-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;
    const jeId = `je-${Date.now()}`;

    const lines: JournalEntryLine[] =
      payload.voucherType === 'receipt'
        ? [
            {
              id: `jel-${Date.now()}-1`,
              accountId: payload.cashBankAccountId,
              debit: payload.amount,
              credit: 0,
              lineMemo: `${voucherNo} — ${payload.partyLabel}`,
              warehouseId: null,
            },
            {
              id: `jel-${Date.now()}-2`,
              accountId: payload.counterAccountId,
              debit: 0,
              credit: payload.amount,
              lineMemo: payload.description,
              warehouseId: null,
            },
          ]
        : [
            {
              id: `jel-${Date.now()}-1`,
              accountId: payload.counterAccountId,
              debit: payload.amount,
              credit: 0,
              lineMemo: payload.description,
              warehouseId: null,
            },
            {
              id: `jel-${Date.now()}-2`,
              accountId: payload.cashBankAccountId,
              debit: 0,
              credit: payload.amount,
              lineMemo: `${voucherNo} — ${payload.partyLabel}`,
              warehouseId: null,
            },
          ];

    const newEntry: JournalEntry = {
      id: jeId,
      entryNo,
      entryDate: payload.voucherDate,
      sourceType:
        payload.voucherType === 'receipt' ? 'receipt_voucher' : 'payment_voucher',
      sourceRefNo: voucherNo,
      description: `${
        payload.voucherType === 'receipt' ? 'سند قبض' : 'سند صرف'
      } (${payload.partyLabel}) — ${payload.description}`,
      status: 'posted',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lines,
    };

    const newVoucher: Voucher = {
      id: `vch-${Date.now()}`,
      voucherNo,
      voucherType: payload.voucherType,
      voucherDate: payload.voucherDate,
      paymentMethod: payload.paymentMethod,
      cashBankAccountId: payload.cashBankAccountId,
      counterAccountId: payload.counterAccountId,
      partyType: payload.partyType,
      partyId: payload.partyId,
      partyLabel: payload.partyLabel,
      amount: payload.amount,
      referenceNo: payload.referenceNo,
      description: payload.description,
      journalEntryId: jeId,
    };

    setJournalEntries((prev) => [...prev, newEntry]);
    setVouchers((prev) => [newVoucher, ...prev]);

    // Update Customer or Supplier balance if linked
    if (payload.partyType === 'customer' && payload.partyId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === payload.partyId
            ? {
                ...c,
                currentBalance:
                  c.currentBalance +
                  (payload.voucherType === 'receipt' ? -payload.amount : payload.amount),
              }
            : c
        )
      );
    } else if (payload.partyType === 'supplier' && payload.partyId) {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === payload.partyId
            ? {
                ...s,
                currentBalance:
                  s.currentBalance +
                  (payload.voucherType === 'payment' ? -payload.amount : payload.amount),
              }
            : s
        )
      );
    }
  };

  const handleRecordFinancialOp = (payload: {
    opCategory: FinancialOpCategory;
    opDate: string;
    accountId: string;
    paymentAccountId: string;
    warehouseId: string | null;
    amount: number;
    includeVat: boolean;
    beneficiaryOrPayer: string;
    notes: string;
  }) => {
    const isExp =
      payload.opCategory === 'operating_expense' ||
      payload.opCategory === 'petty_cash_expense';
    const prefix = isExp ? 'EXP' : 'REV';
    const countOfCat =
      financialOps.filter((f) =>
        isExp
          ? f.opCategory === 'operating_expense' || f.opCategory === 'petty_cash_expense'
          : f.opCategory === 'operating_revenue' || f.opCategory === 'other_revenue'
      ).length + 1;
    const opNo = `${prefix}-2026-${String(countOfCat).padStart(4, '0')}`;

    const taxAmount = payload.includeVat
      ? Number((payload.amount * 0.15).toFixed(2))
      : 0;
    const totalAmount = Number((payload.amount + taxAmount).toFixed(2));
    const vatAccountId =
      rawAccounts.find((a) => a.code === '2102')?.id ?? 'acc-2102';

    const jeId = `je-${Date.now()}`;
    const entryNo = `JV-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;
    const lines: JournalEntryLine[] = [];

    if (isExp) {
      lines.push({
        id: `jel-${Date.now()}-1`,
        accountId: payload.accountId,
        debit: payload.amount,
        credit: 0,
        lineMemo: payload.notes,
        warehouseId: payload.warehouseId,
      });
      if (taxAmount > 0) {
        lines.push({
          id: `jel-${Date.now()}-2`,
          accountId: vatAccountId,
          debit: taxAmount,
          credit: 0,
          lineMemo: `ضريبة مدخلات 15% — ${opNo}`,
          warehouseId: payload.warehouseId,
        });
      }
      lines.push({
        id: `jel-${Date.now()}-3`,
        accountId: payload.paymentAccountId,
        debit: 0,
        credit: totalAmount,
        lineMemo: `${opNo} — ${payload.beneficiaryOrPayer}`,
        warehouseId: payload.warehouseId,
      });
    } else {
      lines.push({
        id: `jel-${Date.now()}-1`,
        accountId: payload.paymentAccountId,
        debit: totalAmount,
        credit: 0,
        lineMemo: `${opNo} — ${payload.beneficiaryOrPayer}`,
        warehouseId: payload.warehouseId,
      });
      lines.push({
        id: `jel-${Date.now()}-2`,
        accountId: payload.accountId,
        debit: 0,
        credit: payload.amount,
        lineMemo: payload.notes,
        warehouseId: payload.warehouseId,
      });
      if (taxAmount > 0) {
        lines.push({
          id: `jel-${Date.now()}-3`,
          accountId: vatAccountId,
          debit: 0,
          credit: taxAmount,
          lineMemo: `ضريبة مخرجات 15% — ${opNo}`,
          warehouseId: payload.warehouseId,
        });
      }
    }

    const newEntry: JournalEntry = {
      id: jeId,
      entryNo,
      entryDate: payload.opDate,
      sourceType: isExp ? 'operating_expense' : 'operating_revenue',
      sourceRefNo: opNo,
      description: payload.notes,
      status: 'posted',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lines,
    };

    const newOp: FinancialOperation = {
      id: `fop-${Date.now()}`,
      opNo,
      opCategory: payload.opCategory,
      opDate: payload.opDate,
      accountId: payload.accountId,
      paymentAccountId: payload.paymentAccountId,
      warehouseId: payload.warehouseId,
      amount: payload.amount,
      taxAmount,
      totalAmount,
      beneficiaryOrPayer: payload.beneficiaryOrPayer,
      notes: payload.notes,
      journalEntryId: jeId,
    };

    setJournalEntries((prev) => [...prev, newEntry]);
    setFinancialOps((prev) => [newOp, ...prev]);
  };

  const handleJumpToJournalEntry = (entryId: string) => {
    setHighlightedEntryId(entryId);
    setActiveTab('journal_entries');
  };

  // ============================================================================
  // Phase 4 Atomic Handlers: Purchases, Sales, Returns & Inventory Adjustments
  // ============================================================================
  const handlePostPurchase = (payload: {
    invoiceType: PurchaseInvoiceType;
    invoiceDate: string;
    supplierId: string;
    warehouseId: string;
    paymentMode: InvoicePaymentMode;
    cashAccountId: string | null;
    lines: { itemId: string; unitId: string; quantity: number; unitPrice: number }[];
    notes: string;
  }): string | null => {
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    const sup = suppliers.find((s) => s.id === payload.supplierId);
    if (!wh || !sup) return 'بيانات المورد أو المستودع غير مكتملة.';

    const settlementAccId =
      payload.paymentMode === 'cash' ? payload.cashAccountId : sup.payableAccountId;
    if (!settlementAccId) return 'يرجى تحديد حساب السداد أو ذمم الموردين.';

    const vatAccountId = rawAccounts.find((a) => a.code === '2102')?.id ?? 'acc-2102';
    const nextStocks = warehouseStocks.map((s) => ({ ...s }));
    const nextItems = items.map((i) => ({ ...i }));
    const invoiceLines: InvoiceLine[] = [];
    let subtotal = 0;

    for (let idx = 0; idx < payload.lines.length; idx++) {
      const rawLine = payload.lines[idx];
      const itemObj = nextItems.find((i) => i.id === rawLine.itemId);
      const unitObj = units.find((u) => u.id === rawLine.unitId);
      if (!itemObj || !unitObj) return 'صنف أو وحدة غير صالحة.';

      const conv = unitObj.conversionFactor;
      const baseQty = Number((rawLine.quantity * conv).toFixed(4));
      const lineTotal = Number((rawLine.quantity * rawLine.unitPrice).toFixed(2));
      const costPerBase = Number((rawLine.unitPrice / conv).toFixed(4));
      subtotal += lineTotal;

      if (itemObj.itemType === 'stock') {
        const stockIdx = nextStocks.findIndex(
          (s) => s.warehouseId === payload.warehouseId && s.itemId === itemObj.id
        );
        const currentWhQty = stockIdx >= 0 ? nextStocks[stockIdx].quantityOnHand : 0;

        if (payload.invoiceType === 'purchase') {
          // Calculate Weighted Average Cost (WAC) globally before adding stock
          const globalQty = nextStocks
            .filter((s) => s.itemId === itemObj.id)
            .reduce((sum, s) => sum + s.quantityOnHand, 0);
          if (globalQty + baseQty > 0) {
            itemObj.costPrice = Number(
              (
                (globalQty * itemObj.costPrice + lineTotal) /
                (globalQty + baseQty)
              ).toFixed(4)
            );
          }
          if (stockIdx >= 0) {
            nextStocks[stockIdx].quantityOnHand = Number(
              (nextStocks[stockIdx].quantityOnHand + baseQty).toFixed(4)
            );
            nextStocks[stockIdx].lastCost = costPerBase;
          } else {
            nextStocks.push({
              warehouseId: payload.warehouseId,
              itemId: itemObj.id,
              quantityOnHand: baseQty,
              lastCost: costPerBase,
            });
          }
        } else {
          if (currentWhQty < baseQty) {
            return `الرصيد المتاح للصنف (${itemObj.nameAr}) هو ${currentWhQty} حبة ولا يكفي لإرجاع ${baseQty}.`;
          }
          nextStocks[stockIdx].quantityOnHand = Number(
            (currentWhQty - baseQty).toFixed(4)
          );
        }
      }

      invoiceLines.push({
        id: `pinvl-${Date.now()}-${idx}`,
        itemId: itemObj.id,
        unitId: unitObj.id,
        quantity: rawLine.quantity,
        conversionFactor: conv,
        baseQuantity: baseQty,
        unitPrice: rawLine.unitPrice,
        lineTotal,
        costSnapshot: costPerBase,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    const taxAmount = Number((subtotal * 0.15).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const prefix = payload.invoiceType === 'purchase' ? 'PINV' : 'PRET';
    const countOfType =
      purchaseInvoices.filter((p) => p.invoiceType === payload.invoiceType).length + 1;
    const invoiceNo = `${prefix}-2026-${String(countOfType).padStart(4, '0')}`;
    const jeId = `je-${Date.now()}`;
    const entryNo = `JV-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;

    const jeLines: JournalEntryLine[] =
      payload.invoiceType === 'purchase'
        ? [
            {
              id: `jel-${Date.now()}-1`,
              accountId: wh.inventoryAccountId,
              debit: subtotal,
              credit: 0,
              lineMemo: `توريد مخزون — ${invoiceNo}`,
              warehouseId: wh.id,
            },
            {
              id: `jel-${Date.now()}-2`,
              accountId: vatAccountId,
              debit: taxAmount,
              credit: 0,
              lineMemo: `ضريبة مدخلات مشتريات 15% — ${invoiceNo}`,
              warehouseId: wh.id,
            },
            {
              id: `jel-${Date.now()}-3`,
              accountId: settlementAccId,
              debit: 0,
              credit: totalAmount,
              lineMemo: `${sup.nameAr} — ${invoiceNo}`,
              warehouseId: wh.id,
            },
          ]
        : [
            {
              id: `jel-${Date.now()}-1`,
              accountId: settlementAccId,
              debit: totalAmount,
              credit: 0,
              lineMemo: `تخفيض ذمم / استرداد من ${sup.nameAr} — ${invoiceNo}`,
              warehouseId: wh.id,
            },
            {
              id: `jel-${Date.now()}-2`,
              accountId: wh.inventoryAccountId,
              debit: 0,
              credit: subtotal,
              lineMemo: `عكس مخزون مرتجع مشتريات — ${invoiceNo}`,
              warehouseId: wh.id,
            },
            {
              id: `jel-${Date.now()}-3`,
              accountId: vatAccountId,
              debit: 0,
              credit: taxAmount,
              lineMemo: `عكس ضريبة مدخلات 15% — ${invoiceNo}`,
              warehouseId: wh.id,
            },
          ];

    const newJe: JournalEntry = {
      id: jeId,
      entryNo,
      entryDate: payload.invoiceDate,
      sourceType:
        payload.invoiceType === 'purchase' ? 'purchase_invoice' : 'purchase_return',
      sourceRefNo: invoiceNo,
      description: payload.notes,
      status: 'posted',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lines: jeLines,
    };

    const newInv: PurchaseInvoice = {
      id: `pinv-${Date.now()}`,
      invoiceNo,
      invoiceType: payload.invoiceType,
      invoiceDate: payload.invoiceDate,
      supplierId: payload.supplierId,
      warehouseId: payload.warehouseId,
      paymentMode: payload.paymentMode,
      cashAccountId: payload.cashAccountId,
      subtotal,
      taxAmount,
      totalAmount,
      notes: payload.notes,
      lines: invoiceLines,
      journalEntryId: jeId,
    };

    setItems(nextItems);
    setWarehouseStocks(nextStocks);
    setJournalEntries((prev) => [...prev, newJe]);
    setPurchaseInvoices((prev) => [newInv, ...prev]);

    if (payload.paymentMode === 'credit') {
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === payload.supplierId
            ? {
                ...s,
                currentBalance: Number(
                  (
                    s.currentBalance +
                    (payload.invoiceType === 'purchase' ? totalAmount : -totalAmount)
                  ).toFixed(2)
                ),
              }
            : s
        )
      );
    }

    return null;
  };

  const handlePostSale = (payload: {
    invoiceType: SalesInvoiceType;
    invoiceDate: string;
    customerId: string;
    warehouseId: string;
    paymentMode: InvoicePaymentMode;
    cashAccountId: string | null;
    lines: { itemId: string; unitId: string; quantity: number; unitPrice: number }[];
    notes: string;
  }): string | null => {
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    const cust = customers.find((c) => c.id === payload.customerId);
    if (!wh || !cust) return 'بيانات العميل أو المستودع غير مكتملة.';

    const settlementAccId =
      payload.paymentMode === 'cash' ? payload.cashAccountId : cust.receivableAccountId;
    if (!settlementAccId) return 'يرجى تحديد حساب التحصيل النقدي أو ذمم العميل.';

    const vatAccountId = rawAccounts.find((a) => a.code === '2102')?.id ?? 'acc-2102';
    const nextStocks = warehouseStocks.map((s) => ({ ...s }));
    const invoiceLines: InvoiceLine[] = [];
    let subtotal = 0;
    let totalCogs = 0;
    let revenueAccountId = 'acc-4101';
    let cogsAccountId = 'acc-5101';

    for (let idx = 0; idx < payload.lines.length; idx++) {
      const rawLine = payload.lines[idx];
      const itemObj = items.find((i) => i.id === rawLine.itemId);
      const unitObj = units.find((u) => u.id === rawLine.unitId);
      if (!itemObj || !unitObj) return 'صنف أو وحدة غير صالحة.';

      if (idx === 0) {
        revenueAccountId = itemObj.revenueAccountId || revenueAccountId;
        cogsAccountId = itemObj.cogsAccountId || cogsAccountId;
      }

      const conv = unitObj.conversionFactor;
      const baseQty = Number((rawLine.quantity * conv).toFixed(4));
      const lineTotal = Number((rawLine.quantity * rawLine.unitPrice).toFixed(2));
      const lineCogs =
        itemObj.itemType === 'stock'
          ? Number((baseQty * itemObj.costPrice).toFixed(2))
          : 0;

      subtotal += lineTotal;
      totalCogs += lineCogs;

      if (itemObj.itemType === 'stock') {
        const stockIdx = nextStocks.findIndex(
          (s) => s.warehouseId === payload.warehouseId && s.itemId === itemObj.id
        );
        const available = stockIdx >= 0 ? nextStocks[stockIdx].quantityOnHand : 0;

        if (payload.invoiceType === 'sale') {
          if (available < baseQty) {
            return `الكمية المتوفرة في (${wh.nameAr}) للصنف (${itemObj.nameAr}) هي ${available} فقط.`;
          }
          nextStocks[stockIdx].quantityOnHand = Number((available - baseQty).toFixed(4));
        } else {
          if (stockIdx >= 0) {
            nextStocks[stockIdx].quantityOnHand = Number(
              (available + baseQty).toFixed(4)
            );
          } else {
            nextStocks.push({
              warehouseId: payload.warehouseId,
              itemId: itemObj.id,
              quantityOnHand: baseQty,
              lastCost: itemObj.costPrice,
            });
          }
        }
      }

      invoiceLines.push({
        id: `sinvl-${Date.now()}-${idx}`,
        itemId: itemObj.id,
        unitId: unitObj.id,
        quantity: rawLine.quantity,
        conversionFactor: conv,
        baseQuantity: baseQty,
        unitPrice: rawLine.unitPrice,
        lineTotal,
        costSnapshot: itemObj.costPrice,
      });
    }

    subtotal = Number(subtotal.toFixed(2));
    totalCogs = Number(totalCogs.toFixed(2));
    const taxAmount = Number((subtotal * 0.15).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    if (payload.invoiceType === 'sale' && payload.paymentMode === 'credit') {
      if (cust.currentBalance + totalAmount > cust.creditLimit) {
        return `البيع الآجل مرفوض لتجاوز الحد الائتماني للعميل (${cust.nameAr}).`;
      }
    }

    const prefix = payload.invoiceType === 'sale' ? 'SINV' : 'SRET';
    const countOfType =
      salesInvoices.filter((s) => s.invoiceType === payload.invoiceType).length + 1;
    const invoiceNo = `${prefix}-2026-${String(countOfType).padStart(4, '0')}`;
    const jeId = `je-${Date.now()}`;
    const entryNo = `JV-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;

    const jeLines: JournalEntryLine[] = [];
    if (payload.invoiceType === 'sale') {
      jeLines.push(
        {
          id: `jel-${Date.now()}-1`,
          accountId: settlementAccId,
          debit: totalAmount,
          credit: 0,
          lineMemo: `${cust.nameAr} (${
            payload.paymentMode === 'cash' ? 'نقدي' : 'آجل'
          }) — ${invoiceNo}`,
          warehouseId: wh.id,
        },
        {
          id: `jel-${Date.now()}-2`,
          accountId: revenueAccountId,
          debit: 0,
          credit: subtotal,
          lineMemo: `إيراد مبيعات — ${invoiceNo}`,
          warehouseId: wh.id,
        },
        {
          id: `jel-${Date.now()}-3`,
          accountId: vatAccountId,
          debit: 0,
          credit: taxAmount,
          lineMemo: `ضريبة مخرجات 15% — ${invoiceNo}`,
          warehouseId: wh.id,
        }
      );
      if (totalCogs > 0) {
        jeLines.push(
          {
            id: `jel-${Date.now()}-4`,
            accountId: cogsAccountId,
            debit: totalCogs,
            credit: 0,
            lineMemo: `تكلفة البضاعة المباعة — ${invoiceNo}`,
            warehouseId: wh.id,
          },
          {
            id: `jel-${Date.now()}-5`,
            accountId: wh.inventoryAccountId,
            debit: 0,
            credit: totalCogs,
            lineMemo: `صرف مخزون مباع من ${wh.nameAr}`,
            warehouseId: wh.id,
          }
        );
      }
    } else {
      jeLines.push(
        {
          id: `jel-${Date.now()}-1`,
          accountId: revenueAccountId,
          debit: subtotal,
          credit: 0,
          lineMemo: `عكس إيراد مرتجع مبيعات — ${invoiceNo}`,
          warehouseId: wh.id,
        },
        {
          id: `jel-${Date.now()}-2`,
          accountId: vatAccountId,
          debit: taxAmount,
          credit: 0,
          lineMemo: `عكس ضريبة مخرجات 15% — ${invoiceNo}`,
          warehouseId: wh.id,
        },
        {
          id: `jel-${Date.now()}-3`,
          accountId: settlementAccId,
          debit: 0,
          credit: totalAmount,
          lineMemo: `تخفيض مديونية/رد نقدية — ${cust.nameAr}`,
          warehouseId: wh.id,
        }
      );
      if (totalCogs > 0) {
        jeLines.push(
          {
            id: `jel-${Date.now()}-4`,
            accountId: wh.inventoryAccountId,
            debit: totalCogs,
            credit: 0,
            lineMemo: `إرجاع مخزون للمستودع — ${invoiceNo}`,
            warehouseId: wh.id,
          },
          {
            id: `jel-${Date.now()}-5`,
            accountId: cogsAccountId,
            debit: 0,
            credit: totalCogs,
            lineMemo: `عكس تكلفة البضاعة المباعة — ${invoiceNo}`,
            warehouseId: wh.id,
          }
        );
      }
    }

    const newJe: JournalEntry = {
      id: jeId,
      entryNo,
      entryDate: payload.invoiceDate,
      sourceType: payload.invoiceType === 'sale' ? 'sales_invoice' : 'sales_return',
      sourceRefNo: invoiceNo,
      description: payload.notes,
      status: 'posted',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lines: jeLines,
    };

    const newInv: SalesInvoice = {
      id: `sinv-${Date.now()}`,
      invoiceNo,
      invoiceType: payload.invoiceType,
      invoiceDate: payload.invoiceDate,
      customerId: payload.customerId,
      warehouseId: payload.warehouseId,
      paymentMode: payload.paymentMode,
      cashAccountId: payload.cashAccountId,
      subtotal,
      taxAmount,
      totalAmount,
      totalCogs,
      notes: payload.notes,
      lines: invoiceLines,
      journalEntryId: jeId,
    };

    setWarehouseStocks(nextStocks);
    setJournalEntries((prev) => [...prev, newJe]);
    setSalesInvoices((prev) => [newInv, ...prev]);

    if (payload.paymentMode === 'credit') {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === payload.customerId
            ? {
                ...c,
                currentBalance: Number(
                  (
                    c.currentBalance +
                    (payload.invoiceType === 'sale' ? totalAmount : -totalAmount)
                  ).toFixed(2)
                ),
              }
            : c
        )
      );
    }

    return null;
  };

  const handlePostAdjustment = (payload: {
    adjustmentDate: string;
    warehouseId: string;
    reason: AdjustmentReason;
    lines: { itemId: string; actualQty: number }[];
    notes: string;
  }): string | null => {
    const wh = warehouses.find((w) => w.id === payload.warehouseId);
    if (!wh) return 'يرجى تحديد المستودع.';

    const nextStocks = warehouseStocks.map((s) => ({ ...s }));
    const adjLines: InventoryAdjustmentLine[] = [];
    let netVarianceValue = 0;

    for (let idx = 0; idx < payload.lines.length; idx++) {
      const rawLine = payload.lines[idx];
      const itemObj = items.find((i) => i.id === rawLine.itemId);
      if (!itemObj) continue;

      const stockIdx = nextStocks.findIndex(
        (s) => s.warehouseId === payload.warehouseId && s.itemId === itemObj.id
      );
      const systemQty = stockIdx >= 0 ? nextStocks[stockIdx].quantityOnHand : 0;
      const varianceQty = Number((rawLine.actualQty - systemQty).toFixed(4));
      const varianceValue = Number((varianceQty * itemObj.costPrice).toFixed(2));
      netVarianceValue += varianceValue;

      if (stockIdx >= 0) {
        nextStocks[stockIdx].quantityOnHand = rawLine.actualQty;
      } else {
        nextStocks.push({
          warehouseId: payload.warehouseId,
          itemId: itemObj.id,
          quantityOnHand: rawLine.actualQty,
          lastCost: itemObj.costPrice,
        });
      }

      adjLines.push({
        id: `adjl-${Date.now()}-${idx}`,
        itemId: itemObj.id,
        systemQty,
        actualQty: rawLine.actualQty,
        varianceQty,
        unitCost: itemObj.costPrice,
        varianceValue,
      });
    }

    netVarianceValue = Number(netVarianceValue.toFixed(2));
    const adjustmentNo = `ADJ-2026-${String(adjustments.length + 1).padStart(4, '0')}`;
    let jeId = '';

    if (netVarianceValue !== 0) {
      jeId = `je-${Date.now()}`;
      const entryNo = `JV-2026-${String(journalEntries.length + 1).padStart(4, '0')}`;
      const lossAccId = rawAccounts.find((a) => a.code === '5205')?.id ?? 'acc-5205';
      const gainAccId = rawAccounts.find((a) => a.code === '4201')?.id ?? 'acc-4201';
      const absVal = Math.abs(netVarianceValue);

      const jeLines: JournalEntryLine[] =
        netVarianceValue > 0
          ? [
              {
                id: `jel-${Date.now()}-1`,
                accountId: wh.inventoryAccountId,
                debit: absVal,
                credit: 0,
                lineMemo: `إثبات زيادة جردية في ${wh.nameAr}`,
                warehouseId: wh.id,
              },
              {
                id: `jel-${Date.now()}-2`,
                accountId: gainAccId,
                debit: 0,
                credit: absVal,
                lineMemo: `أرباح فروقات جرد — ${adjustmentNo}`,
                warehouseId: wh.id,
              },
            ]
          : [
              {
                id: `jel-${Date.now()}-1`,
                accountId: lossAccId,
                debit: absVal,
                credit: 0,
                lineMemo: `خسائر عجز / تلف مخزني — ${adjustmentNo}`,
                warehouseId: wh.id,
              },
              {
                id: `jel-${Date.now()}-2`,
                accountId: wh.inventoryAccountId,
                debit: 0,
                credit: absVal,
                lineMemo: `تخفيض مخزون ${wh.nameAr} بعد الجرد`,
                warehouseId: wh.id,
              },
            ];

      const newJe: JournalEntry = {
        id: jeId,
        entryNo,
        entryDate: payload.adjustmentDate,
        sourceType: 'inventory_adjustment',
        sourceRefNo: adjustmentNo,
        description: payload.notes,
        status: 'posted',
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        lines: jeLines,
      };

      setJournalEntries((prev) => [...prev, newJe]);
    }

    const newAdj: InventoryAdjustment = {
      id: `adj-${Date.now()}`,
      adjustmentNo,
      adjustmentDate: payload.adjustmentDate,
      warehouseId: payload.warehouseId,
      reason: payload.reason,
      notes: payload.notes,
      totalVarianceValue: netVarianceValue,
      lines: adjLines,
      journalEntryId: jeId,
    };

    setWarehouseStocks(nextStocks);
    setAdjustments((prev) => [newAdj, ...prev]);
    return null;
  };

  const getNavMetaCount = (tabId: ActiveTab): string | null => {
    switch (tabId) {
      case 'items':
        return `${items.length} صنف`;
      case 'warehouses':
        return `${warehouses.length} مخزن`;
      case 'units':
        return `${units.length} وحدة`;
      case 'customers':
        return `${customers.length} عميل`;
      case 'suppliers':
        return `${suppliers.length} مورد`;
      case 'partners':
        return `${partners.length} شريك`;
      case 'sales':
        return `${salesInvoices.length}`;
      case 'purchases':
        return `${purchaseInvoices.length}`;
      case 'journal_entries':
        return `${journalEntries.length}`;
      case 'accounts':
        return `${accounts.length}`;
      default:
        return null;
    }
  };

  const getInactiveIconTone = (group: NavItem['group']): string => {
    switch (group) {
      case 'overview':
        return 'text-emerald-400';
      case 'phase5':
        return 'text-teal-400';
      case 'phase4':
        return 'text-amber-400';
      case 'phase3':
        return 'text-sky-400';
      case 'phase2':
        return 'text-indigo-400';
      case 'phase1':
        return 'text-emerald-400';
      case 'schema':
        return 'text-slate-300';
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex">
      {/* Mobile Sidebar Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Deep Navy-Charcoal Executive Sidebar matching Reference Theme */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 bg-[#0d1526] text-slate-100 border-l border-slate-800/90 flex flex-col transition-all duration-200 lg:static lg:translate-x-0 ${
          sidebarCollapsed ? 'lg:w-20 w-72' : 'w-72'
        } ${mobileNavOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="h-[72px] px-4 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 shadow-md shadow-emerald-950/50 flex items-center justify-center text-white shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-base font-bold tracking-tight text-white truncate">
                  ميزان للحسابات
                </div>
                <div className="text-[11px] font-medium text-emerald-400 truncate">
                  نظام تخطيط الموارد ERP
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="hidden lg:inline-flex p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors shrink-0"
            aria-label={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
            title={sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.key} className="space-y-1.5">
              {!sidebarCollapsed && (
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400/80 tracking-wide">
                  {group.title}
                </div>
              )}
              {NAV_ITEMS.filter((item) => item.group === group.key).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const metaCount = getNavMetaCount(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      if (item.id !== 'journal_entries') setHighlightedEntryId(null);
                      setMobileNavOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                    } rounded-2xl text-right transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-l from-emerald-600 to-emerald-500 text-white font-semibold shadow-lg shadow-emerald-950/35'
                        : 'text-slate-300 hover:bg-slate-800/65 hover:text-white'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : `bg-slate-800/85 ${getInactiveIconTone(item.group)}`
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    {!sidebarCollapsed && (
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold truncate">{item.label}</span>
                          {metaCount && (
                            <span
                              className={`text-[10px] font-mono tabular-nums shrink-0 ${
                                isActive ? 'text-emerald-50' : 'text-slate-400'
                              }`}
                            >
                              {metaCount}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isActive ? 'text-emerald-50/90' : 'text-slate-400/90'
                          }`}
                          dir="ltr"
                        >
                          {item.subtitle}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
          {!sidebarCollapsed ? (
            <>
              <div className="font-medium text-slate-200">قاعدة البيانات السحابية</div>
              <div className="font-mono text-[11px] text-emerald-400/90" dir="ltr">
                PostgreSQL 15+ / Supabase
              </div>
            </>
          ) : (
            <div className="text-center font-mono text-[10px] text-emerald-400" title="PostgreSQL 15+ / Supabase">
              SQL
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar with Signature Mint Cash & Amber Inventory Summary Tiles */}
        <header className="min-h-[72px] sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-2 text-slate-600 hover:text-slate-950 rounded-xl hover:bg-slate-100 lg:hidden"
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold text-slate-950 truncate">
                {activeNav.label}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                المنشأة: مجموعة ميزان للتجارة والتوزيع
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Mint Emerald Cash Liquidity Tile */}
            <button
              type="button"
              onClick={() => setActiveTab('accounts')}
              className="hidden xl:flex items-center gap-2.5 px-3.5 py-1.5 bg-emerald-50/90 hover:bg-emerald-100/80 border border-emerald-200/90 rounded-2xl transition-colors text-right"
              title="عرض سيولة الخزائن والبنوك في شجرة الحسابات"
            >
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="text-[10px] font-semibold text-emerald-800/80">
                  سيولة الخزائن والبنوك (1101)
                </div>
                <div className="text-xs font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
                  {cashBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </button>

            {/* Warm Amber Inventory Value Tile */}
            <button
              type="button"
              onClick={() => setActiveTab('inventory_adjustments')}
              className="hidden xl:flex items-center gap-2.5 px-3.5 py-1.5 bg-amber-50/90 hover:bg-amber-100/80 border border-amber-200/90 rounded-2xl transition-colors text-right"
              title="عرض أرصدة المخزون والتسويات"
            >
              <Package className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <div className="text-[10px] font-semibold text-amber-800/80">
                  قيمة المخزون السلعي (1103)
                </div>
                <div className="text-xs font-bold font-mono tabular-nums text-amber-700" dir="ltr">
                  {inventoryBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-colors whitespace-nowrap shrink-0"
              title="تصدير كافة جداول الحسابات والمخازن والفواتير بصيغة JSON"
            >
              {exportedJson ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>تم التصدير</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>نسخة احتياطية</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyAllSql}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              {copiedTop ? (
                <>
                  <Check className="w-4 h-4 text-emerald-100" />
                  <span>تم نسخ SQL</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ كود SQL</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Quick Operational Strip Card matching Reference Theme */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveTab('inventory_adjustments')}
                className="px-5 py-3.5 text-right hover:bg-emerald-50/40 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-500">
                  رصيد المخزون السلعي (1103)
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
                    {inventoryBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">تحديث آلي</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('accounts')}
                className="px-5 py-3.5 text-right hover:bg-emerald-50/40 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-500">
                  النقدية والبنوك (1101)
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-950" dir="ltr">
                    {cashBalanceTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">cash</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sales')}
                className="px-5 py-3.5 text-right hover:bg-emerald-50/40 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-500">
                  فواتير المبيعات والمشتريات
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-950">
                    {salesInvoices.length} / {purchaseInvoices.length}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">invoices</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('journal_entries')}
                className="px-5 py-3.5 text-right hover:bg-emerald-50/40 transition-colors"
              >
                <div className="text-[11px] font-medium text-slate-500">
                  قيود اليومية المُرحّلة
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-bold font-mono tabular-nums text-slate-950">
                    {journalEntries.length}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">journal_entries</span>
                </div>
              </button>
            </div>
          </div>

          {/* Active View */}
          {activeTab === 'sql' && <SqlSchemaView />}
          {activeTab === 'erd' && <ErdDiagramView />}
          {activeTab === 'accounts' && (
            <ChartOfAccountsView
              accounts={accounts}
              onAddAccount={handleAddAccount}
            />
          )}
          {activeTab === 'warehouses' && (
            <WarehousesView
              warehouses={warehouses}
              accounts={accounts}
              onAddWarehouse={handleAddWarehouse}
              onSetDefault={handleSetDefaultWarehouse}
            />
          )}
          {activeTab === 'units' && (
            <UnitsView units={units} onAddUnit={handleAddUnit} />
          )}
          {activeTab === 'items' && (
            <ItemsView
              items={items}
              units={units}
              warehouses={warehouses}
              accounts={accounts}
              onAddItem={handleAddItem}
            />
          )}
          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              accounts={accounts}
              warehouses={warehouses}
              onAddCustomer={handleAddCustomer}
            />
          )}
          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              accounts={accounts}
              onAddSupplier={handleAddSupplier}
            />
          )}
          {activeTab === 'employees' && (
            <EmployeesView
              employees={employees}
              warehouses={warehouses}
              accounts={accounts}
              onAddEmployee={handleAddEmployee}
            />
          )}
          {activeTab === 'partners' && (
            <PartnersView
              partners={partners}
              transactions={partnerTxs}
              accounts={accounts}
              onAddPartner={handleAddPartner}
              onAddTransaction={handleAddPartnerTx}
            />
          )}
          {activeTab === 'users_roles' && (
            <UsersRolesView
              roles={roles}
              permissions={permissions}
              users={users}
              employees={employees}
              warehouses={warehouses}
              onTogglePermission={handleTogglePermission}
              onAddRole={handleAddRole}
              onAddUser={handleAddUser}
              onToggleUserActive={handleToggleUserActive}
            />
          )}
          {activeTab === 'expenses_revenues' && (
            <ExpensesRevenuesView
              operations={financialOps}
              accounts={accounts}
              warehouses={warehouses}
              onRecordOperation={handleRecordFinancialOp}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'vouchers' && (
            <VouchersView
              vouchers={vouchers}
              accounts={accounts}
              customers={customers}
              suppliers={suppliers}
              partners={partners}
              onPostVoucher={handlePostVoucher}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'sales' && (
            <SalesView
              invoices={salesInvoices}
              customers={customers}
              warehouses={warehouses}
              items={items}
              units={units}
              accounts={accounts}
              warehouseStocks={warehouseStocks}
              onPostSale={handlePostSale}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'purchases' && (
            <PurchasesView
              invoices={purchaseInvoices}
              suppliers={suppliers}
              warehouses={warehouses}
              items={items}
              units={units}
              accounts={accounts}
              warehouseStocks={warehouseStocks}
              onPostPurchase={handlePostPurchase}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'inventory_adjustments' && (
            <InventoryAdjustmentsView
              adjustments={adjustments}
              warehouses={warehouses}
              items={items}
              units={units}
              warehouseStocks={warehouseStocks}
              onPostAdjustment={handlePostAdjustment}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'journal_entries' && (
            <JournalEntriesView
              entries={journalEntries}
              accounts={accounts}
              warehouses={warehouses}
              highlightedEntryId={highlightedEntryId}
              onPostManualEntry={handlePostManualEntry}
            />
          )}
          {activeTab === 'financial_reports' && (
            <FinancialReportsView
              accounts={accounts}
              journalEntries={journalEntries}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'inventory_reports' && (
            <InventoryReportsView
              items={items}
              units={units}
              warehouses={warehouses}
              warehouseStocks={warehouseStocks}
              purchaseInvoices={purchaseInvoices}
              salesInvoices={salesInvoices}
              adjustments={adjustments}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'party_reports' && (
            <PartyReportsView
              customers={customers}
              suppliers={suppliers}
              salesInvoices={salesInvoices}
              purchaseInvoices={purchaseInvoices}
              vouchers={vouchers}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
          {activeTab === 'partner_reports' && (
            <PartnerReportsView
              partners={partners}
              transactions={partnerTxs}
              accounts={accounts}
              journalEntries={journalEntries}
            />
          )}
          {activeTab === 'dashboard' && (
            <DashboardSummaryView
              accounts={accounts}
              journalEntries={journalEntries}
              items={items}
              units={units}
              warehouses={warehouses}
              warehouseStocks={warehouseStocks}
              salesInvoices={salesInvoices}
              purchaseInvoices={purchaseInvoices}
              customers={customers}
              suppliers={suppliers}
              vouchers={vouchers}
              onNavigate={setActiveTab}
              onViewJournalEntry={handleJumpToJournalEntry}
            />
          )}
        </main>
      </div>
    </div>
  );
}
