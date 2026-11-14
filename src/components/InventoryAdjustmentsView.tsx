import { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import {
  AdjustmentReason,
  InventoryAdjustment,
  Item,
  Unit,
  Warehouse,
  WarehouseStock,
} from '../types/erp';

interface InventoryAdjustmentsViewProps {
  adjustments: InventoryAdjustment[];
  warehouses: Warehouse[];
  items: Item[];
  units: Unit[];
  warehouseStocks: WarehouseStock[];
  onPostAdjustment: (payload: {
    adjustmentDate: string;
    warehouseId: string;
    reason: AdjustmentReason;
    lines: { itemId: string; actualQty: number }[];
    notes: string;
  }) => string | null;
  onViewJournalEntry: (entryId: string) => void;
}

const REASON_LABELS: Record<AdjustmentReason, string> = {
  shortage: 'عجز جردي',
  surplus: 'زيادة جردية',
  damage: 'تلف وهالك',
  book_variance: 'فروقات دفترية',
};

interface DraftAdjLine {
  key: string;
  itemId: string;
  actualQty: string;
}

export function InventoryAdjustmentsView({
  adjustments,
  warehouses,
  items,
  units,
  warehouseStocks,
  onPostAdjustment,
  onViewJournalEntry,
}: InventoryAdjustmentsViewProps) {
  const [selectedWhFilter, setSelectedWhFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const stockItems = useMemo(
    () => items.filter((i) => i.itemType === 'stock'),
    [items]
  );

  // Modal state
  const [adjustmentDate, setAdjustmentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [reason, setReason] = useState<AdjustmentReason>('shortage');
  const [notes, setNotes] = useState('');
  const [draftLines, setDraftLines] = useState<DraftAdjLine[]>([]);
  const [formError, setFormError] = useState('');

  const getSystemQty = (whId: string, itemId: string) => {
    return (
      warehouseStocks.find((s) => s.warehouseId === whId && s.itemId === itemId)
        ?.quantityOnHand ?? 0
    );
  };

  const visibleStocks = useMemo(() => {
    return warehouseStocks
      .filter((s) => selectedWhFilter === 'all' || s.warehouseId === selectedWhFilter)
      .map((s) => {
        const item = items.find((i) => i.id === s.itemId);
        const wh = warehouses.find((w) => w.id === s.warehouseId);
        const unit = units.find((u) => u.id === item?.baseUnitId);
        const cost = item?.costPrice ?? s.lastCost;
        return {
          ...s,
          item,
          wh,
          unit,
          cost,
          totalValue: s.quantityOnHand * cost,
          isLow: item ? s.quantityOnHand <= item.minStockLevel : false,
        };
      });
  }, [warehouseStocks, selectedWhFilter, items, warehouses, units]);

  const totalInventoryValue = useMemo(
    () => visibleStocks.reduce((sum, s) => sum + s.totalValue, 0),
    [visibleStocks]
  );

  const openModal = () => {
    const whId =
      selectedWhFilter !== 'all' ? selectedWhFilter : warehouses[0]?.id ?? '';
    const firstItem = stockItems[0];
    const sysQty = firstItem ? getSystemQty(whId, firstItem.id) : 0;

    setAdjustmentDate(new Date().toISOString().slice(0, 10));
    setWarehouseId(whId);
    setReason('shortage');
    setNotes('');
    setDraftLines([
      {
        key: `adj-${Date.now()}`,
        itemId: firstItem?.id ?? '',
        actualQty: String(Math.max(0, sysQty - 1)),
      },
    ]);
    setFormError('');
    setShowModal(true);
  };

  const draftNetVariance = useMemo(() => {
    let total = 0;
    for (const line of draftLines) {
      const item = items.find((i) => i.id === line.itemId);
      const sysQty = getSystemQty(warehouseId, line.itemId);
      const actQty = Number(line.actualQty);
      if (!Number.isNaN(actQty) && item) {
        total += (actQty - sysQty) * item.costPrice;
      }
    }
    return Number(total.toFixed(2));
  }, [draftLines, warehouseId, items, warehouseStocks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) {
      setFormError('يرجى تحديد المستودع.');
      return;
    }
    const parsedLines: { itemId: string; actualQty: number }[] = [];
    for (const l of draftLines) {
      const act = Number(l.actualQty);
      if (!l.itemId || Number.isNaN(act) || act < 0) {
        setFormError('يرجى إدخال كمية جرد فعلي صحيحة (0 أو أكبر).');
        return;
      }
      parsedLines.push({ itemId: l.itemId, actualQty: act });
    }
    if (parsedLines.length === 0) {
      setFormError('أضف صنفاً واحداً على الأقل للتسوية.');
      return;
    }

    const err = onPostAdjustment({
      adjustmentDate,
      warehouseId,
      reason,
      lines: parsedLines,
      notes: notes.trim() || `تسوية جردية (${REASON_LABELS[reason]})`,
    });
    if (err) {
      setFormError(err);
      return;
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Live Warehouse Stocks Matrix */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              أرصدة المستودعات الحية (warehouse_stocks)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إجمالي القيمة المخزنية المعروضة:{' '}
              <strong className="font-mono text-slate-900" dir="ltr">
                {totalInventoryValue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setSelectedWhFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedWhFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                كل المستودعات
              </button>
              {warehouses.map((wh) => (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => setSelectedWhFilter(wh.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    selectedWhFilter === wh.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {wh.code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>تسوية جردية جديدة</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">المستودع</th>
                <th className="py-3 px-4">كود الصنف</th>
                <th className="py-3 px-4">اسم الصنف</th>
                <th className="py-3 px-4 text-left">الرصيد الحالي</th>
                <th className="py-3 px-4">الوحدة الأساسية</th>
                <th className="py-3 px-4 text-left">متوسط التكلفة (WAC)</th>
                <th className="py-3 px-4 text-left">القيمة المخزنية</th>
                <th className="py-3 px-4">حالة الحد الأدنى</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {visibleStocks.map((row) => (
                <tr
                  key={`${row.warehouseId}-${row.itemId}`}
                  className="hover:bg-slate-50/70 transition-colors"
                >
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                    {row.wh?.nameAr ?? '—'}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-semibold tabular-nums">
                    {row.item?.sku ?? '—'}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {row.item?.nameAr ?? '—'}
                  </td>
                  <td
                    className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums"
                    dir="ltr"
                  >
                    {row.quantityOnHand.toLocaleString('en-US')}
                  </td>
                  <td className="py-3 px-4 text-slate-500">{row.unit?.nameAr ?? '—'}</td>
                  <td
                    className="py-3 px-4 text-left font-mono text-slate-700 tabular-nums"
                    dir="ltr"
                  >
                    {row.cost.toFixed(2)}
                  </td>
                  <td
                    className="py-3 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                    dir="ltr"
                  >
                    {row.totalValue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className={`font-medium ${
                        row.isLow ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {row.isLow
                        ? `منخفض (الحد ${row.item?.minStockLevel})`
                        : 'رصيد آمن'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustments History */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            سجل التسويات الجردية (inventory_adjustments)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تُسجّل فروقات العجز والزيادة والتلف والفروقات الدفترية وتُولّد قيود التسوية تلقائياً
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">رقم التسوية</th>
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">المستودع</th>
                <th className="py-3 px-4">السبب</th>
                <th className="py-3 px-4">التفاصيل</th>
                <th className="py-3 px-4 text-left">الأثر المالي</th>
                <th className="py-3 px-4">القيد الآلي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {adjustments.map((adj) => {
                const wh = warehouses.find((w) => w.id === adj.warehouseId);
                return (
                  <tr key={adj.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                      {adj.adjustmentNo}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 tabular-nums">
                      {adj.adjustmentDate}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{wh?.nameAr ?? '—'}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {REASON_LABELS[adj.reason]}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {adj.lines.length} أصناف · {adj.notes}
                    </td>
                    <td
                      className={`py-3 px-4 text-left font-mono font-bold tabular-nums ${
                        adj.totalVarianceValue >= 0
                          ? 'text-emerald-700'
                          : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {adj.totalVarianceValue >= 0 ? '+' : ''}
                      {adj.totalVarianceValue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {adj.journalEntryId ? (
                        <button
                          type="button"
                          onClick={() => onViewJournalEntry(adj.journalEntryId)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>عرض القيد</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">بلا فرق مالي</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {adjustments.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                    لم يتم تسجيل تسويات جردية بعد. اضغط «تسوية جردية جديدة» لمعالجة عجز أو زيادة أو تلف.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Inventory Adjustment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                إنشاء تسوية جردية للمخزون (عجز / زيادة / تلف / فروقات دفترية)
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تاريخ الجرد
                  </label>
                  <input
                    type="date"
                    value={adjustmentDate}
                    onChange={(e) => setAdjustmentDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                  />
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
                    نوع / سبب التسوية
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as AdjustmentReason)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="shortage">عجز جردي (Shortage)</option>
                    <option value="surplus">زيادة جردية (Surplus)</option>
                    <option value="damage">تلف وهالك (Damage)</option>
                    <option value="book_variance">فروقات دفترية (Book Variance)</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    مقارنة الرصيد الدفتري بالجرد الفعلي (بالوحدة الأساسية)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const fallback = stockItems[0];
                      const sys = fallback ? getSystemQty(warehouseId, fallback.id) : 0;
                      setDraftLines((prev) => [
                        ...prev,
                        {
                          key: `adj-${Date.now()}`,
                          itemId: fallback?.id ?? '',
                          actualQty: String(sys),
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
                    const sysQty = getSystemQty(warehouseId, line.itemId);
                    const actQty = Number(line.actualQty) || 0;
                    const diffQty = actQty - sysQty;
                    const diffVal = diffQty * (item?.costPrice ?? 0);

                    return (
                      <div
                        key={line.key}
                        className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center text-xs"
                      >
                        <div className="sm:col-span-5">
                          <select
                            value={line.itemId}
                            onChange={(e) => {
                              const nextSys = getSystemQty(warehouseId, e.target.value);
                              setDraftLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx
                                    ? {
                                        ...l,
                                        itemId: e.target.value,
                                        actualQty: String(nextSys),
                                      }
                                    : l
                                )
                              );
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                          >
                            {stockItems.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.sku} — {it.nameAr}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2 text-slate-600 font-mono" dir="ltr">
                          دفتري: {sysQty}
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={line.actualQty}
                            onChange={(e) =>
                              setDraftLines((prev) =>
                                prev.map((l, i) =>
                                  i === idx ? { ...l, actualQty: e.target.value } : l
                                )
                              )
                            }
                            placeholder="الفعلي"
                            dir="ltr"
                            className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md"
                          />
                        </div>
                        <div
                          className={`sm:col-span-2 font-mono font-semibold tabular-nums ${
                            diffQty >= 0 ? 'text-emerald-700' : 'text-red-700'
                          }`}
                          dir="ltr"
                        >
                          {diffQty >= 0 ? '+' : ''}
                          {diffQty} ({diffVal.toFixed(2)})
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          <button
                            type="button"
                            disabled={draftLines.length <= 1}
                            onClick={() =>
                              setDraftLines((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                            aria-label="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  ملاحظات لجنة الجرد
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: جرد ربع سنوي — معالجة تلف شحن أو فرق دفتري"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  صافي الأثر المالي للتسوية:{' '}
                  <span
                    className={`font-mono ${
                      draftNetVariance >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                    dir="ltr"
                  >
                    {draftNetVariance >= 0 ? '+' : ''}
                    {draftNetVariance.toFixed(2)}
                  </span>
                </div>
                <div className="text-slate-600">
                  {draftNetVariance > 0
                    ? `القيد الآلي: مدين (مخزون المستودع) بمبلغ ${Math.abs(
                        draftNetVariance
                      ).toFixed(2)} ← دائن (4201 إيرادات تشغيلية متنوعة / فروقات جرد)`
                    : draftNetVariance < 0
                    ? `القيد الآلي: مدين (5205 خسائر عجز وتلف المخزون) بمبلغ ${Math.abs(
                        draftNetVariance
                      ).toFixed(2)} ← دائن (مخزون المستودع)`
                    : 'لا يوجد فرق كمي أو مالي يتطلب قيد تسوية.'}
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  اعتماد التسوية وتحديث المخزون والشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
