import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import {
  ChartAccount,
  Customer,
  InvoicePaymentMode,
  Item,
  SalesInvoice,
  SalesInvoiceType,
  Unit,
  Warehouse,
  WarehouseStock,
} from '../types/erp';

interface SalesViewProps {
  invoices: SalesInvoice[];
  customers: Customer[];
  warehouses: Warehouse[];
  items: Item[];
  units: Unit[];
  accounts: ChartAccount[];
  warehouseStocks: WarehouseStock[];
  onPostSale: (payload: {
    invoiceType: SalesInvoiceType;
    invoiceDate: string;
    customerId: string;
    warehouseId: string;
    paymentMode: InvoicePaymentMode;
    cashAccountId: string | null;
    lines: { itemId: string; unitId: string; quantity: number; unitPrice: number }[];
    notes: string;
  }) => string | null;
  onViewJournalEntry: (entryId: string) => void;
}

interface DraftLine {
  key: string;
  itemId: string;
  unitId: string;
  quantity: string;
  unitPrice: string;
}

export function SalesView({
  invoices,
  customers,
  warehouses,
  items,
  units,
  accounts,
  warehouseStocks,
  onPostSale,
  onViewJournalEntry,
}: SalesViewProps) {
  const [filterType, setFilterType] = useState<'all' | SalesInvoiceType>('all');
  const [showModal, setShowModal] = useState(false);

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable && a.code.startsWith('1101')),
    [accounts]
  );

  // Form state
  const [invoiceType, setInvoiceType] = useState<SalesInvoiceType>('sale');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [paymentMode, setPaymentMode] = useState<InvoicePaymentMode>('cash');
  const [cashAccountId, setCashAccountId] = useState(cashAccounts[0]?.id ?? '');
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState('');

  const getCompatibleUnits = (item: Item | undefined) => {
    if (!item) return units;
    return units.filter(
      (u) => u.id === item.baseUnitId || u.baseUnitId === item.baseUnitId
    );
  };

  const getWarehouseQty = (whId: string, itemId: string) => {
    return (
      warehouseStocks.find((s) => s.warehouseId === whId && s.itemId === itemId)
        ?.quantityOnHand ?? 0
    );
  };

  const openModal = (type: SalesInvoiceType) => {
    const firstItem = items[0];
    const baseUnit = units.find((u) => u.id === firstItem?.baseUnitId) ?? units[0];
    const defaultCust = customers[0];

    setInvoiceType(type);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setCustomerId(defaultCust?.id ?? '');
    setWarehouseId(defaultCust?.defaultWarehouseId ?? warehouses[0]?.id ?? '');
    setPaymentMode(defaultCust && defaultCust.creditLimit > 0 ? 'credit' : 'cash');
    setCashAccountId(cashAccounts[0]?.id ?? '');
    setNotes('');
    setDraftLines([
      {
        key: `sl-${Date.now()}`,
        itemId: firstItem?.id ?? '',
        unitId: baseUnit?.id ?? '',
        quantity: '1',
        unitPrice: String(firstItem?.sellingPrice ?? 0),
      },
    ]);
    setFormError('');
    setShowModal(true);
  };

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((inv) => filterType === 'all' || inv.invoiceType === filterType),
    [invoices, filterType]
  );

  const summary = useMemo(() => {
    const salesTotal = invoices
      .filter((i) => i.invoiceType === 'sale')
      .reduce((s, i) => s + i.totalAmount, 0);
    const returnsTotal = invoices
      .filter((i) => i.invoiceType === 'sales_return')
      .reduce((s, i) => s + i.totalAmount, 0);
    const netSubtotal = invoices.reduce(
      (s, i) => s + (i.invoiceType === 'sale' ? i.subtotal : -i.subtotal),
      0
    );
    const netCogs = invoices.reduce(
      (s, i) => s + (i.invoiceType === 'sale' ? i.totalCogs : -i.totalCogs),
      0
    );
    return {
      salesTotal,
      returnsTotal,
      netCogs,
      grossProfit: netSubtotal - netCogs,
    };
  }, [invoices]);

  const draftTotals = useMemo(() => {
    let subtotal = 0;
    let cogs = 0;
    for (const line of draftLines) {
      const item = items.find((i) => i.id === line.itemId);
      const unit = units.find((u) => u.id === line.unitId);
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unitPrice) || 0;
      const baseQty = qty * (unit?.conversionFactor ?? 1);
      subtotal += qty * price;
      if (item && item.itemType === 'stock') {
        cogs += baseQty * item.costPrice;
      }
    }
    const tax = Number((subtotal * 0.15).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    cogs = Number(cogs.toFixed(2));
    return { subtotal, tax, total, cogs };
  }, [draftLines, items, units]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const creditExceeded =
    invoiceType === 'sale' &&
    paymentMode === 'credit' &&
    selectedCustomer !== undefined &&
    selectedCustomer.currentBalance + draftTotals.total > selectedCustomer.creditLimit;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !warehouseId) {
      setFormError('يرجى تحديد العميل والمستودع.');
      return;
    }
    if (paymentMode === 'cash' && !cashAccountId) {
      setFormError('يرجى اختيار حساب الصندوق أو البنك للتحصيل النقدي.');
      return;
    }
    if (creditExceeded && selectedCustomer) {
      setFormError(
        `البيع الآجل مرفوض: رصيد العميل بعد الفاتورة (${(
          selectedCustomer.currentBalance + draftTotals.total
        ).toFixed(2)}) يتجاوز الحد الائتماني (${selectedCustomer.creditLimit.toFixed(2)}).`
      );
      return;
    }

    const parsedLines: {
      itemId: string;
      unitId: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

    for (const l of draftLines) {
      const qty = Number(l.quantity) || 0;
      const price = Number(l.unitPrice) || 0;
      if (!l.itemId || !l.unitId || qty <= 0) {
        setFormError('يرجى التأكد من إدخال الصنف والكمية الصحيحة لكل بند.');
        return;
      }
      const item = items.find((i) => i.id === l.itemId);
      const unit = units.find((u) => u.id === l.unitId);
      const baseQty = qty * (unit?.conversionFactor ?? 1);

      if (invoiceType === 'sale' && item?.itemType === 'stock') {
        const available = getWarehouseQty(warehouseId, item.id);
        if (baseQty > available) {
          setFormError(
            `الكمية المتوفرة في المستودع للصنف (${item.nameAr}) هي ${available} حبة فقط ولا تكفي لصرف ${baseQty}.`
          );
          return;
        }
      }

      parsedLines.push({
        itemId: l.itemId,
        unitId: l.unitId,
        quantity: qty,
        unitPrice: price,
      });
    }

    const error = onPostSale({
      invoiceType,
      invoiceDate,
      customerId,
      warehouseId,
      paymentMode,
      cashAccountId: paymentMode === 'cash' ? cashAccountId : null,
      lines: parsedLines,
      notes:
        notes.trim() ||
        `${invoiceType === 'sale' ? 'فاتورة مبيعات' : 'مرتجع مبيعات'} (${
          paymentMode === 'cash' ? 'نقدي' : 'آجل'
        }) — ${selectedCustomer?.nameAr ?? ''}`,
    });

    if (error) {
      setFormError(error);
      return;
    }
    setShowModal(false);
  };

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);
  const selectedWarehouseAcc = accounts.find(
    (a) => a.id === selectedWarehouse?.inventoryAccountId
  );
  const settlementAcc =
    paymentMode === 'cash'
      ? accounts.find((a) => a.id === cashAccountId)
      : accounts.find((a) => a.id === selectedCustomer?.receivableAccountId);

  return (
    <div className="space-y-4">
      {/* KPI Summary Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200">
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي المبيعات (شامل الضريبة)</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700"
            dir="ltr"
          >
            {summary.salesTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">مرتجعات المبيعات</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700"
            dir="ltr"
          >
            {summary.returnsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">صافي تكلفة البضاعة المباعة (COGS)</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900"
            dir="ltr"
          >
            {summary.netCogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">مجمل الربح (قبل الضريبة)</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700"
            dir="ltr"
          >
            {summary.grossProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(
            [
              { id: 'all', label: `الكل (${invoices.length})` },
              {
                id: 'sale',
                label: `فواتير مبيعات (${
                  invoices.filter((i) => i.invoiceType === 'sale').length
                })`,
              },
              {
                id: 'sales_return',
                label: `مرتجعات مبيعات (${
                  invoices.filter((i) => i.invoiceType === 'sales_return').length
                })`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => openModal('sale')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>فاتورة مبيعات (نقدي / آجل)</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('sales_return')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>مرتجع مبيعات</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">رقم الفاتورة</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">العميل</th>
                <th className="py-3 px-4">المستودع</th>
                <th className="py-3 px-4">السداد</th>
                <th className="py-3 px-4 text-left">الإجمالي</th>
                <th className="py-3 px-4 text-left">التكلفة COGS</th>
                <th className="py-3 px-4 text-left">مجمل الربح</th>
                <th className="py-3 px-4">القيد المزدوج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.map((inv) => {
                const cust = customers.find((c) => c.id === inv.customerId);
                const wh = warehouses.find((w) => w.id === inv.warehouseId);
                const isReturn = inv.invoiceType === 'sales_return';
                const profit = inv.subtotal - inv.totalCogs;

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {inv.invoiceNo}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          isReturn ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {isReturn ? 'مرتجع مبيعات' : 'فاتورة مبيعات'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{cust?.nameAr ?? '—'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {inv.lines.length} أصناف · {inv.notes}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {wh?.nameAr ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {inv.paymentMode === 'cash' ? 'نقدي' : 'آجل (ذمم)'}
                    </td>
                    <td
                      className={`py-3 px-4 text-left font-mono font-bold tabular-nums ${
                        isReturn ? 'text-amber-700' : 'text-slate-900'
                      }`}
                      dir="ltr"
                    >
                      {isReturn ? '-' : ''}
                      {inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className="py-3 px-4 text-left font-mono text-slate-600 tabular-nums"
                      dir="ltr"
                    >
                      {inv.totalCogs.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className="py-3 px-4 text-left font-mono font-semibold text-emerald-700 tabular-nums"
                      dir="ltr"
                    >
                      {isReturn ? '-' : ''}
                      {profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewJournalEntry(inv.journalEntryId)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>عرض القيد</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Sales Invoice / Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-slate-900">
                {invoiceType === 'sale'
                  ? 'إصدار فاتورة مبيعات (خصم المستودع + قيد المبيعات وقيد COGS)'
                  : 'إصدار مرتجع مبيعات (إعادة المخزون + عكس المبيعات والتكلفة)'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تاريخ الفاتورة
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    العميل
                  </label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المستودع المنصرف منه
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    نوع الدفع
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) =>
                      setPaymentMode(e.target.value as InvoicePaymentMode)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="cash">نقدي / شبكة</option>
                    <option value="credit">آجل (ذمم العميل)</option>
                  </select>
                </div>
              </div>

              {paymentMode === 'cash' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      حساب التحصيل (الصندوق / البنك)
                    </label>
                    <select
                      value={cashAccountId}
                      onChange={(e) => setCashAccountId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      {cashAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                selectedCustomer && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      creditExceeded
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>
                      الرصيد الحالي للعميل:{' '}
                      <strong className="font-mono" dir="ltr">
                        {selectedCustomer.currentBalance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </strong>{' '}
                      · الحد الائتماني:{' '}
                      <strong className="font-mono" dir="ltr">
                        {selectedCustomer.creditLimit.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </strong>
                    </span>
                    <span className="font-semibold">
                      {creditExceeded
                        ? 'تجاوز الحد الائتماني — لا يمكن الترحيل آجلاً'
                        : `المتاح للائتمان: ${(
                            selectedCustomer.creditLimit -
                            selectedCustomer.currentBalance
                          ).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    </span>
                  </div>
                )
              )}

              {/* Sales Lines */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    أصناف الفاتورة ومراقبة الرصيد المخزني والتكلفة
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fallback = items[0];
                      const u =
                        units.find((x) => x.id === fallback?.baseUnitId) ?? units[0];
                      setDraftLines((prev) => [
                        ...prev,
                        {
                          key: `sl-${Date.now()}`,
                          itemId: fallback?.id ?? '',
                          unitId: u?.id ?? '',
                          quantity: '1',
                          unitPrice: String(fallback?.sellingPrice ?? 0),
                        },
                      ]);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة صنف</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {draftLines.map((line, idx) => {
                    const item = items.find((i) => i.id === line.itemId);
                    const compatUnits = getCompatibleUnits(item);
                    const unit = units.find((u) => u.id === line.unitId);
                    const conv = unit?.conversionFactor ?? 1;
                    const qty = Number(line.quantity) || 0;
                    const price = Number(line.unitPrice) || 0;
                    const baseQty = qty * conv;
                    const lineTotal = qty * price;
                    const lineCogs =
                      item?.itemType === 'stock' ? baseQty * item.costPrice : 0;
                    const available = item ? getWarehouseQty(warehouseId, item.id) : 0;
                    const insufficient =
                      invoiceType === 'sale' &&
                      item?.itemType === 'stock' &&
                      baseQty > available;

                    return (
                      <div key={line.key} className="p-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <select
                              value={line.itemId}
                              onChange={(e) => {
                                const nextItem = items.find(
                                  (i) => i.id === e.target.value
                                );
                                const nextUnit = units.find(
                                  (u) => u.id === nextItem?.baseUnitId
                                );
                                setDraftLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          itemId: e.target.value,
                                          unitId: nextUnit?.id ?? l.unitId,
                                          unitPrice: String(nextItem?.sellingPrice ?? 0),
                                        }
                                      : l
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                            >
                              {items.map((it) => (
                                <option key={it.id} value={it.id}>
                                  {it.sku} — {it.nameAr}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <select
                              value={line.unitId}
                              onChange={(e) => {
                                const nextUnit = units.find(
                                  (u) => u.id === e.target.value
                                );
                                const nextConv = nextUnit?.conversionFactor ?? 1;
                                setDraftLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          unitId: e.target.value,
                                          unitPrice: String(
                                            Number(
                                              (
                                                (item?.sellingPrice ?? 0) * nextConv
                                              ).toFixed(2)
                                            )
                                          ),
                                        }
                                      : l
                                  )
                                );
                              }}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                            >
                              {compatUnits.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nameAr} (×{u.conversionFactor})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={line.quantity}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, quantity: e.target.value } : l
                                  )
                                )
                              }
                              placeholder="الكمية"
                              dir="ltr"
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, unitPrice: e.target.value } : l
                                  )
                                )
                              }
                              placeholder="سعر البيع"
                              dir="ltr"
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md"
                            />
                          </div>

                          <div className="sm:col-span-1 flex justify-end">
                            <button
                              type="button"
                              disabled={draftLines.length <= 1}
                              onClick={() =>
                                setDraftLines((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                              aria-label="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div
                            className={
                              insufficient ? 'text-red-700 font-semibold' : 'text-slate-500'
                            }
                          >
                            {item?.itemType === 'service'
                              ? 'صنف خدمي (لا يتطلب رصيد مخزني)'
                              : `المطلوب بالوحدة الأساسية: ${baseQty} · المتوفر بالمستودع: ${available}`}
                            {lineCogs > 0 && ` · التكلفة COGS: ${lineCogs.toFixed(2)}`}
                          </div>
                          <div className="font-mono font-semibold text-slate-900" dir="ltr">
                            Line Total: {lineTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  بيان / ملاحظات الفاتورة
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: بيع أجهزة نقاط بيع مع التسليم الفوري"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              {/* Dual Journal Preview */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <span>
                    الصافي:{' '}
                    <strong className="font-mono" dir="ltr">
                      {draftTotals.subtotal.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    ضريبة 15%:{' '}
                    <strong className="font-mono" dir="ltr">
                      {draftTotals.tax.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    الإجمالي:{' '}
                    <strong className="font-mono text-emerald-700 text-sm" dir="ltr">
                      {draftTotals.total.toFixed(2)}
                    </strong>
                  </span>
                  <span>
                    التكلفة COGS:{' '}
                    <strong className="font-mono text-slate-800" dir="ltr">
                      {draftTotals.cogs.toFixed(2)}
                    </strong>
                  </span>
                </div>
                <div className="space-y-1 text-slate-600">
                  <div>
                    1. قيد الإيراد:{' '}
                    {invoiceType === 'sale'
                      ? `مدين (${settlementAcc?.code} ${settlementAcc?.nameAr}) ← دائن (المبيعات + 2102 الضريبة)`
                      : `مدين (المبيعات + 2102 الضريبة) ← دائن (${settlementAcc?.code} ${settlementAcc?.nameAr})`}
                  </div>
                  {draftTotals.cogs > 0 && (
                    <div>
                      2. قيد التكلفة والمخزون:{' '}
                      {invoiceType === 'sale'
                        ? `مدين (5101 تكلفة البضاعة المباعة) ${draftTotals.cogs.toFixed(
                            2
                          )} ← دائن (${selectedWarehouseAcc?.code} ${
                            selectedWarehouseAcc?.nameAr
                          })`
                        : `مدين (${selectedWarehouseAcc?.code} ${
                            selectedWarehouseAcc?.nameAr
                          }) ← دائن (5101 تكلفة البضاعة المباعة) ${draftTotals.cogs.toFixed(
                            2
                          )}`}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-xs font-semibold text-white rounded-lg ${
                    invoiceType === 'sale'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-amber-700 hover:bg-amber-800'
                  }`}
                >
                  حفظ وترحيل الفاتورة وتوليد القيود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
