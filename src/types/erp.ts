export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';
export type ItemType = 'stock' | 'service';

export interface ChartAccount {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentId: string | null;
  level: number;
  isPostable: boolean;
  isActive: boolean;
  currentBalance: number;
}

export interface Warehouse {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  location: string;
  managerName: string;
  phone: string;
  inventoryAccountId: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Unit {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  symbol: string;
  baseUnitId: string | null;
  conversionFactor: number;
  isActive: boolean;
}

export interface Item {
  id: string;
  sku: string;
  barcode: string;
  nameAr: string;
  nameEn: string;
  itemType: ItemType;
  baseUnitId: string;
  purchaseUnitId: string;
  defaultWarehouseId: string | null;
  costPrice: number;
  sellingPrice: number;
  minStockLevel: number;
  inventoryAccountId: string;
  cogsAccountId: string;
  revenueAccountId: string;
  isActive: boolean;
}

// ============================================================================
// Phase 2: Parties, HR, Partners, Users & Roles
// ============================================================================

export type CustomerTier = 'retail' | 'wholesale' | 'corporate' | 'vip';

export interface Customer {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  customerTier: CustomerTier;
  taxNumber: string;
  phone: string;
  email: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
  paymentTermsDays: number;
  receivableAccountId: string;
  defaultWarehouseId: string | null;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  taxNumber: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  paymentTermsDays: number;
  currentBalance: number;
  payableAccountId: string;
  isActive: boolean;
}

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

export interface Employee {
  id: string;
  employeeCode: string;
  fullNameAr: string;
  fullNameEn: string;
  nationalId: string;
  department: string;
  jobTitle: string;
  hireDate: string;
  phone: string;
  email: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  warehouseId: string | null;
  salaryExpenseAccountId: string;
  advanceAccountId: string;
  employmentStatus: EmploymentStatus;
}

export interface Partner {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nationalId: string;
  phone: string;
  ownershipPercent: number;
  capitalContribution: number;
  capitalAccountId: string;
  currentAccountId: string;
  isActive: boolean;
}

export type PartnerTxType =
  | 'capital_injection'
  | 'drawing'
  | 'profit_share'
  | 'loss_share'
  | 'loan_to_company';

export interface PartnerCurrentTx {
  id: string;
  partnerId: string;
  transactionDate: string;
  transactionType: PartnerTxType;
  direction: NormalBalance;
  amount: number;
  referenceNo: string;
  notes: string;
}

export type ErpModuleKey =
  | 'accounts'
  | 'warehouses'
  | 'items'
  | 'customers'
  | 'suppliers'
  | 'employees'
  | 'partners'
  | 'sales'
  | 'purchases'
  | 'users_roles';

export interface Role {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  isSystemRole: boolean;
}

export interface RolePermission {
  id: string;
  roleId: string;
  moduleKey: ErpModuleKey;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
}

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roleId: string;
  employeeId: string | null;
  defaultWarehouseId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

// ============================================================================
// Phase 3: Financial Transactions, Vouchers & Journal Entries
// ============================================================================

export type JournalSourceType =
  | 'manual'
  | 'receipt_voucher'
  | 'payment_voucher'
  | 'operating_expense'
  | 'operating_revenue'
  | 'purchase_invoice'
  | 'purchase_return'
  | 'sales_invoice'
  | 'sales_return'
  | 'inventory_adjustment';

export type JournalStatus = 'draft' | 'posted' | 'reversed';

export interface JournalEntryLine {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  lineMemo: string;
  warehouseId: string | null;
}

export interface JournalEntry {
  id: string;
  entryNo: string;
  entryDate: string;
  sourceType: JournalSourceType;
  sourceRefNo: string;
  description: string;
  status: JournalStatus;
  lines: JournalEntryLine[];
  createdAt: string;
}

export type VoucherType = 'receipt' | 'payment';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'pos_card';
export type VoucherPartyType = 'customer' | 'supplier' | 'partner' | 'other';

export interface Voucher {
  id: string;
  voucherNo: string;
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
  journalEntryId: string;
}

export type FinancialOpCategory =
  | 'operating_expense'
  | 'petty_cash_expense'
  | 'operating_revenue'
  | 'other_revenue';

export interface FinancialOperation {
  id: string;
  opNo: string;
  opCategory: FinancialOpCategory;
  opDate: string;
  accountId: string;
  paymentAccountId: string;
  warehouseId: string | null;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  beneficiaryOrPayer: string;
  notes: string;
  journalEntryId: string;
}

// ============================================================================
// Phase 4: Inventory Stocks, Purchases, Sales, Returns & Adjustments
// ============================================================================

export interface WarehouseStock {
  warehouseId: string;
  itemId: string;
  quantityOnHand: number; // Always in base_unit
  lastCost: number;
}

export type InvoicePaymentMode = 'cash' | 'credit';

export interface InvoiceLine {
  id: string;
  itemId: string;
  unitId: string;
  quantity: number;
  conversionFactor: number;
  baseQuantity: number;
  unitPrice: number; // Cost per entered unit (purchases) or selling price per entered unit (sales)
  lineTotal: number;
  costSnapshot: number; // Cost per base unit at time of transaction
}

export type PurchaseInvoiceType = 'purchase' | 'purchase_return';

export interface PurchaseInvoice {
  id: string;
  invoiceNo: string;
  invoiceType: PurchaseInvoiceType;
  invoiceDate: string;
  supplierId: string;
  warehouseId: string;
  paymentMode: InvoicePaymentMode;
  cashAccountId: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string;
  lines: InvoiceLine[];
  journalEntryId: string;
}

export type SalesInvoiceType = 'sale' | 'sales_return';

export interface SalesInvoice {
  id: string;
  invoiceNo: string;
  invoiceType: SalesInvoiceType;
  invoiceDate: string;
  customerId: string;
  warehouseId: string;
  paymentMode: InvoicePaymentMode;
  cashAccountId: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  totalCogs: number;
  notes: string;
  lines: InvoiceLine[];
  journalEntryId: string;
}

export type AdjustmentReason = 'surplus' | 'shortage' | 'damage' | 'book_variance';

export interface InventoryAdjustmentLine {
  id: string;
  itemId: string;
  systemQty: number;
  actualQty: number;
  varianceQty: number; // actualQty - systemQty
  unitCost: number;
  varianceValue: number;
}

export interface InventoryAdjustment {
  id: string;
  adjustmentNo: string;
  adjustmentDate: string;
  warehouseId: string;
  reason: AdjustmentReason;
  notes: string;
  totalVarianceValue: number;
  lines: InventoryAdjustmentLine[];
  journalEntryId: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'sql'
  | 'erd'
  | 'accounts'
  | 'warehouses'
  | 'units'
  | 'items'
  | 'customers'
  | 'suppliers'
  | 'employees'
  | 'partners'
  | 'users_roles'
  | 'expenses_revenues'
  | 'vouchers'
  | 'journal_entries'
  | 'purchases'
  | 'sales'
  | 'inventory_adjustments'
  | 'financial_reports'
  | 'inventory_reports'
  | 'party_reports'
  | 'partner_reports';
