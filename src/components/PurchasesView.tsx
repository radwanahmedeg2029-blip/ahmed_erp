import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import {
  ChartAccount,
  InvoicePaymentMode,
  Item,
  PurchaseInvoice,
  PurchaseInvoiceType,
  Supplier,
  Unit,
  Warehouse,
  WarehouseStock,
} from '../types/erp';

interface PurchasesViewProps {
  invoices: PurchaseInvoice[];
  suppliers: Supplier[];
  warehouses: Warehouse[];
  items: Item[];
  units: Unit[];
  accounts: ChartAccount[];
  warehouseStocks: WarehouseStock[];
  onPostPurchase: (payload: {
    invoiceType: PurchaseInvoiceType;
    invoiceDate: string;
    supplierId: string;
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

export function PurchasesView({
  invoices,
  suppliers,
  warehouses,
  items,
  units,
  accounts,
  warehouseStocks,
  onPostPurchase,
  onViewJournalEntry,
}: PurchasesViewProps) {
  const [filterType, setFilterType] = useState<'all' | PurchaseInvoiceType>('all');
  const [showModal, setShowModal] = useState(false);

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable && a.code.startsWith('1101')),
    [accounts]
  );

  // Form state
  const [invoiceType, setInvoiceType] = useState<PurchaseInvoiceType>('purchase');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [paymentMode, setPaymentMode] = useState<InvoicePaymentMode>('credit');
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

  const getGlobalQty = (itemId: string) => {
    return warehouseStocks
      .filter((s) => s.itemId === itemId)
      .reduce((sum, s) => sum + s.quantityOnHand, 0);
  };

  const openModal = (type: PurchaseInvoiceType) => {
    const firstItem = items.find((i) => i.itemType === 'stock') ?? items[0];
    const defaultUnit =
      units.find((u) => u.id === firstItem?.purchaseUnitId) ??
      units.find((u) => u.id === firstItem?.baseUnitId) ??
      units[0];
    const conv = defaultUnit?.conversionFactor ?? 1;

    setInvoiceType(type);
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setSupplierId(suppliers[0]?.id ?? '');
    setWarehouseId(warehouses[0]?.id ?? '');
    setPaymentMode('credit');
    setCashAccountId(cashAccounts[0]?.id ?? '');
    setNotes('');
    setDraftLines([
      {
        key: `pl-${Date.now()}`,
        itemId: firstItem?.id ?? '',
        unitId: defaultUnit?.id ?? '',
        quantity: '1',
        unitPrice: String(Number(((firstItem?.costPrice ?? 0) * conv).toFixed(2))),
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
    const purchases = invoices
      .filter((i) => i.invoiceType === 'purchase')
      .reduce((s, i) => s + i.totalAmount, 0);
    const returns = invoices
      .filter((i) => i.invoiceType === 'purchase_return')
      .reduce((s, i) => s + i.totalAmount, 0);
    return { purchases, returns, net: purchases - returns };
  }, [invoices]);

  const draftTotals = useMemo(() => {
    let subtotal = 0;
    for (const line of draftLines) {
      subtotal += (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
    }
    const tax = Number((subtotal * 0.15).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
  }, [draftLines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !warehouseId) {
      setFormError('يرجى تحديد المورد والمستودع المستلم.');
      return;
    }
    if (paymentMode === 'cash' && !cashAccountId) {
      setFormError('يرجى اختيار حساب الصندوق أو البنك للسداد النقدي.');
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
        setFormError('يرجى التأكد من إدخال الصنف والكمية الصحيحة لجميع السطور.');
        return;
      }
      const item = items.find((i) => i.id === l.itemId);
      const unit = units.find((u) => u.id === l.unitId);
      const baseQty = qty * (unit?.conversionFactor ?? 1);

      if (invoiceType === 'purchase_return' && item?.itemType === 'stock') {
        const available = getWarehouseQty(warehouseId, item.id);
        if (baseQty > available) {
          setFormError(
            `الكمية المتوفرة في المستودع للصنف (${item.nameAr}) هي ${available} حبة فقط، ولا تكفي لإرجاع ${baseQty}.`
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

    const error = onPostPurchase({
      invoiceType,
      invoiceDate,
      supplierId,
      warehouseId,
      paymentMode,
      cashAccountId: paymentMode === 'cash' ? cashAccountId : null,
      lines: parsedLines,
      notes:
        notes.trim() ||
        `${invoiceType === 'purchase' ? 'فاتورة مشتريات' : 'مرتجع مشتريات'} — ${
          suppliers.find((s) => s.id === supplierId)?.nameAr ?? ''
        }`,
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
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const settlementAcc =
    paymentMode === 'cash'
      ? accounts.find((a) => a.id === cashAccountId)
      : accounts.find((a) => a.id === selectedSupplier?.payableAccountId);

  return (
    <div className="space-y-4">
      {/* KPI Summary Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي فواتير المشتريات (شامل الضريبة)</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700"
            dir="ltr"
          >
            {summary.purchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي مرتجعات المشتريات</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700"
            dir="ltr"
          >
            {summary.returns.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">صافي المشتريات المُرحّلة</div>
          <div
            className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900"
            dir="ltr"
          >
            {summary.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Filter & Actions Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(
            [
              { id: 'all', label: `الكل (${invoices.length})` },
              {
                id: 'purchase',
                label: `فواتير مشتريات (${
                  invoices.filter((i) => i.invoiceType === 'purchase').length
                })`,
              },
              {
                id: 'purchase_return',
                label: `مرتجعات مشتريات (${
                  invoices.filter((i) => i.invoiceType === 'purchase_return').length
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
            onClick={() => openModal('purchase')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>فاتورة مشتريات جديدة</span>
          </button>
          <button
            type="button"
            onClick={() => openModal('purchase_return')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>مرتجع مشتريات</span>
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">رقم المستند</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">النوع</th>
                <th className="py-3 px-4">المورد</th>
                <th className="py-3 px-4">المستودع</th>
                <th className="py-3 px-4">السداد</th>
                <th className="py-3 px-4 text-left">الصافي</th>
                <th className="py-3 px-4 text-left">الضريبة 15%</th>
                <th className="py-3 px-4 text-left">الإجمالي</th>
                <th className="py-3 px-4">القيد الآلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.map((inv) => {
                const sup = suppliers.find((s) => s.id === inv.supplierId);
                const wh = warehouses.find((w) => w.id === inv.warehouseId);
                const isReturn = inv.invoiceType === 'purchase_return';

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
                        {isReturn ? 'مرتجع مشتريات' : 'فاتورة مشتريات'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{sup?.nameAr ?? '—'}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {inv.lines.length} أصناف · {inv.notes}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      {wh?.nameAr ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {inv.paymentMode === 'cash' ? 'نقدي / بنكي' : 'آجل (ذمم)'}
                    </td>
                    <td
                      className="py-3 px-4 text-left font-mono text-slate-700 tabular-nums"
                      dir="ltr"
                    >
                      {inv.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className="py-3 px-4 text-left font-mono text-slate-500 tabular-nums"
                      dir="ltr"
                    >
                      {inv.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-xs text-slate-500">
                    لا توجد فواتير مشتريات أو مرتجعات مسجلة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Invoice / Return Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-slate-900">
                {invoiceType === 'purchase'
                  ? 'ترحيل فاتورة مشتريات (زيادة المخزون + تحديث المتوسط المرجح للتكلفة)'
                  : 'ترحيل مرتجع مشتريات (خصم المخزون + عكس القيد وذمم المورد)'}
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
                    المورد
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المستودع
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
                    طريقة السداد
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) =>
                      setPaymentMode(e.target.value as InvoicePaymentMode)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="credit">آجل (ذمم الموردين)</option>
                    <option value="cash">نقدي / تحويل بنكي</option>
                  </select>
                </div>
              </div>

              {paymentMode === 'cash' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      حساب الصندوق / البنك
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
              )}

              {/* Invoice Lines */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    بنود الأصناف ومعامل التحويل وحساب المتوسط المرجح (WAC)
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
                          key: `pl-${Date.now()}`,
                          itemId: fallback?.id ?? '',
                          unitId: u?.id ?? '',
                          quantity: '1',
                          unitPrice: String(fallback?.costPrice ?? 0),
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
                    const whQty = item ? getWarehouseQty(warehouseId, item.id) : 0;
                    const globalQty = item ? getGlobalQty(item.id) : 0;
                    const projectedWac =
                      item && invoiceType === 'purchase' && globalQty + baseQty > 0
                        ? (globalQty * item.costPrice + lineTotal) /
                          (globalQty + baseQty)
                        : item?.costPrice ?? 0;

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
                                const nextUnit =
                                  units.find(
                                    (u) => u.id === nextItem?.purchaseUnitId
                                  ) ??
                                  units.find((u) => u.id === nextItem?.baseUnitId);
                                const nextConv = nextUnit?.conversionFactor ?? 1;
                                setDraftLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx
                                      ? {
                                          ...l,
                                          itemId: e.target.value,
                                          unitId: nextUnit?.id ?? l.unitId,
                                          unitPrice: String(
                                            Number(
                                              (
                                                (nextItem?.costPrice ?? 0) * nextConv
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
                                              ((item?.costPrice ?? 0) * nextConv).toFixed(
                                                2
                                              )
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
                              placeholder="سعر الوحدة"
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

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                          <div>
                            الكمية بالوحدة الأساسية:{' '}
                            <strong className="font-mono text-slate-800" dir="ltr">
                              {baseQty.toLocaleString('en-US')}
                            </strong>{' '}
                            · الرصيد الحالي بالمستودع:{' '}
                            <strong className="font-mono text-slate-800" dir="ltr">
                              {whQty.toLocaleString('en-US')}
                            </strong>
                            {invoiceType === 'purchase' && item?.itemType === 'stock' && (
                              <>
                                {' · '}التكلفة المتوسطة الجديدة (WAC):{' '}
                                <strong className="font-mono text-emerald-700" dir="ltr">
                                  {projectedWac.toFixed(2)}
                                </strong>
                              </>
                            )}
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
                  ملاحظات الفاتورة
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: توريد بضاعة موسمية — مرجع المورد"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              {/* Totals & Auto-Journal Preview */}
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
                    الإجمالي النهائي:{' '}
                    <strong className="font-mono text-emerald-700 text-sm" dir="ltr">
                      {draftTotals.total.toFixed(2)}
                    </strong>
                  </span>
                </div>
                <div className="text-slate-600">
                  {invoiceType === 'purchase' ? (
                    <span>
                      القيد التلقائي: مدين ({selectedWarehouseAcc?.code}{' '}
                      {selectedWarehouseAcc?.nameAr}) بمبلغ {draftTotals.subtotal.toFixed(2)}{' '}
                      + مدين (2102 الضريبة) بمبلغ {draftTotals.tax.toFixed(2)} ← دائن (
                      {settlementAcc?.code} {settlementAcc?.nameAr}) بمبلغ{' '}
                      {draftTotals.total.toFixed(2)}
                    </span>
                  ) : (
                    <span>
                      القيد التلقائي للمرتجع: مدين ({settlementAcc?.code}{' '}
                      {settlementAcc?.nameAr}) بمبلغ {draftTotals.total.toFixed(2)} ← دائن (
                      {selectedWarehouseAcc?.code} المخزون) + دائن (2102 الضريبة)
                    </span>
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
                    invoiceType === 'purchase'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-700 hover:bg-amber-800'
                  }`}
                >
                  حفظ وترحيل الفاتورة والمخزون والقيد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
