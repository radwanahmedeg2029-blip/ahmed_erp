import { useMemo, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import {
  InventoryAdjustment,
  Item,
  PurchaseInvoice,
  SalesInvoice,
  Unit,
  Warehouse,
  WarehouseStock,
} from '../types/erp';

interface InventoryReportsViewProps {
  items: Item[];
  units: Unit[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  purchaseInvoices: PurchaseInvoice[];
  salesInvoices: SalesInvoice[];
  adjustments: InventoryAdjustment[];
  onViewJournalEntry: (entryId: string) => void;
}

type InventorySubTab = 'cardex' | 'warehouse_balances' | 'stagnant_items';

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join(
    '\n'
  );
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface CardexRow {
  date: string;
  warehouseId: string;
  warehouseName: string;
  typeLabel: string;
  docNo: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  notes: string;
  journalEntryId: string;
}

export function InventoryReportsView({
  items,
  units,
  warehouses,
  warehouseStocks,
  purchaseInvoices,
  salesInvoices,
  adjustments,
  onViewJournalEntry,
}: InventoryReportsViewProps) {
  const [subTab, setSubTab] = useState<InventorySubTab>('cardex');
  const stockItems = useMemo(
    () => items.filter((i) => i.itemType === 'stock'),
    [items]
  );

  const [selectedItemId, setSelectedItemId] = useState<string>(
    () => stockItems[0]?.id ?? ''
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [stagnantThresholdDays, setStagnantThresholdDays] = useState<number>(60);
  const [referenceDate, setReferenceDate] = useState<string>('2026-11-13');

  // 1) Item Cardex (reconstructs opening balance + chronological movements ending at exact warehouseStock)
  const cardexData = useMemo(() => {
    const item = items.find((i) => i.id === selectedItemId);
    if (!item) {
      return { item: null, baseUnitName: '', openingQty: 0, rows: [], closingQty: 0, totalIn: 0, totalOut: 0 };
    }
    const baseUnitName =
      units.find((u) => u.id === item.baseUnitId)?.nameAr ?? 'وحدة';

    const rawEvents: CardexRow[] = [];

    for (const inv of purchaseInvoices) {
      if (selectedWarehouseId !== 'all' && inv.warehouseId !== selectedWarehouseId)
        continue;
      const whName = warehouses.find((w) => w.id === inv.warehouseId)?.nameAr ?? '—';
      for (const line of inv.lines) {
        if (line.itemId !== item.id) continue;
        const isIn = inv.invoiceType === 'purchase';
        rawEvents.push({
          date: inv.invoiceDate,
          warehouseId: inv.warehouseId,
          warehouseName: whName,
          typeLabel: isIn ? 'وارد مشتريات' : 'منصرف مرتجع مشتريات',
          docNo: inv.invoiceNo,
          qtyIn: isIn ? line.baseQuantity : 0,
          qtyOut: isIn ? 0 : line.baseQuantity,
          unitCost: line.costSnapshot,
          notes: inv.notes,
          journalEntryId: inv.journalEntryId,
        });
      }
    }

    for (const inv of salesInvoices) {
      if (selectedWarehouseId !== 'all' && inv.warehouseId !== selectedWarehouseId)
        continue;
      const whName = warehouses.find((w) => w.id === inv.warehouseId)?.nameAr ?? '—';
      for (const line of inv.lines) {
        if (line.itemId !== item.id) continue;
        const isOut = inv.invoiceType === 'sale';
        rawEvents.push({
          date: inv.invoiceDate,
          warehouseId: inv.warehouseId,
          warehouseName: whName,
          typeLabel: isOut ? 'منصرف مبيعات' : 'وارد مرتجع مبيعات',
          docNo: inv.invoiceNo,
          qtyIn: isOut ? 0 : line.baseQuantity,
          qtyOut: isOut ? line.baseQuantity : 0,
          unitCost: line.costSnapshot,
          notes: inv.notes,
          journalEntryId: inv.journalEntryId,
        });
      }
    }

    for (const adj of adjustments) {
      if (selectedWarehouseId !== 'all' && adj.warehouseId !== selectedWarehouseId)
        continue;
      const whName = warehouses.find((w) => w.id === adj.warehouseId)?.nameAr ?? '—';
      for (const line of adj.lines) {
        if (line.itemId !== item.id || line.varianceQty === 0) continue;
        const isIn = line.varianceQty > 0;
        rawEvents.push({
          date: adj.adjustmentDate,
          warehouseId: adj.warehouseId,
          warehouseName: whName,
          typeLabel: isIn ? 'تسوية جردية (زيادة)' : 'تسوية جردية (عجز/تلف)',
          docNo: adj.adjustmentNo,
          qtyIn: isIn ? line.varianceQty : 0,
          qtyOut: isIn ? 0 : Math.abs(line.varianceQty),
          unitCost: line.unitCost,
          notes: adj.notes,
          journalEntryId: adj.journalEntryId,
        });
      }
    }

    rawEvents.sort((a, b) =>
      a.date === b.date ? a.docNo.localeCompare(b.docNo) : a.date.localeCompare(b.date)
    );

    const actualOnHand = warehouseStocks
      .filter(
        (s) =>
          s.itemId === item.id &&
          (selectedWarehouseId === 'all' || s.warehouseId === selectedWarehouseId)
      )
      .reduce((sum, s) => sum + s.quantityOnHand, 0);

    const netTrackedDelta = rawEvents.reduce((sum, e) => sum + (e.qtyIn - e.qtyOut), 0);
    const openingQty = Number((actualOnHand - netTrackedDelta).toFixed(4));

    let running = openingQty;
    let totalIn = 0;
    let totalOut = 0;
    const rows = rawEvents.map((ev) => {
      running = Number((running + ev.qtyIn - ev.qtyOut).toFixed(4));
      totalIn += ev.qtyIn;
      totalOut += ev.qtyOut;
      return {
        ...ev,
        runningQty: running,
        runningValue: Number((running * item.costPrice).toFixed(2)),
      };
    });

    return {
      item,
      baseUnitName,
      openingQty,
      rows,
      closingQty: running,
      totalIn,
      totalOut,
    };
  }, [
    items,
    units,
    warehouses,
    warehouseStocks,
    purchaseInvoices,
    salesInvoices,
    adjustments,
    selectedItemId,
    selectedWarehouseId,
  ]);

  // 2) Current Warehouse Stock Valuation
  const stockValuation = useMemo(() => {
    const rows = warehouseStocks
      .filter(
        (s) =>
          selectedWarehouseId === 'all' || s.warehouseId === selectedWarehouseId
      )
      .map((s) => {
        const item = items.find((i) => i.id === s.itemId);
        const wh = warehouses.find((w) => w.id === s.warehouseId);
        const unit = units.find((u) => u.id === item?.baseUnitId);
        const wacCost = item?.costPrice ?? s.lastCost;
        const totalValue = Number((s.quantityOnHand * wacCost).toFixed(2));
        return {
          ...s,
          item,
          wh,
          unit,
          wacCost,
          totalValue,
          isLow: item ? s.quantityOnHand <= item.minStockLevel : false,
        };
      })
      .sort((a, b) => b.totalValue - a.totalValue);

    const totalValue = rows.reduce((s, r) => s + r.totalValue, 0);
    const totalUnits = rows.reduce((s, r) => s + r.quantityOnHand, 0);
    const lowStockCount = rows.filter((r) => r.isLow).length;

    return { rows, totalValue, totalUnits, lowStockCount };
  }, [warehouseStocks, selectedWarehouseId, items, warehouses, units]);

  // 3) Stagnant / Slow-Moving Items Report
  const stagnantReport = useMemo(() => {
    const refMs = new Date(referenceDate).getTime();
    const openingStartMs = new Date('2026-01-01').getTime();

    let totalInventoryCapital = 0;

    const candidates = stockItems
      .map((item) => {
        const qtyOnHand = warehouseStocks
          .filter(
            (s) =>
              s.itemId === item.id &&
              (selectedWarehouseId === 'all' || s.warehouseId === selectedWarehouseId)
          )
          .reduce((sum, s) => sum + s.quantityOnHand, 0);

        const tiedUpCapital = Number((qtyOnHand * item.costPrice).toFixed(2));
        totalInventoryCapital += tiedUpCapital;

        // Find last sale date for this item
        const itemSales = salesInvoices
          .filter(
            (inv) =>
              inv.invoiceType === 'sale' &&
              (selectedWarehouseId === 'all' || inv.warehouseId === selectedWarehouseId) &&
              inv.lines.some((l) => l.itemId === item.id)
          )
          .map((inv) => inv.invoiceDate)
          .sort();

        const lastSaleDate =
          itemSales.length > 0 ? itemSales[itemSales.length - 1] : null;
        const baseMs = lastSaleDate ? new Date(lastSaleDate).getTime() : openingStartMs;
        const daysStagnant = Math.max(
          0,
          Math.floor((refMs - baseMs) / (1000 * 60 * 60 * 24))
        );

        const unitName = units.find((u) => u.id === item.baseUnitId)?.nameAr ?? 'حبة';

        return {
          item,
          unitName,
          qtyOnHand,
          tiedUpCapital,
          lastSaleDate,
          daysStagnant,
        };
      })
      .filter((r) => r.qtyOnHand > 0 && r.daysStagnant >= stagnantThresholdDays)
      .sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

    const totalStagnantCapital = candidates.reduce((s, c) => s + c.tiedUpCapital, 0);
    const stagnantSharePercent =
      totalInventoryCapital > 0
        ? (totalStagnantCapital / totalInventoryCapital) * 100
        : 0;

    return {
      rows: candidates,
      totalStagnantCapital,
      totalInventoryCapital,
      stagnantSharePercent,
    };
  }, [
    stockItems,
    warehouseStocks,
    salesInvoices,
    selectedWarehouseId,
    stagnantThresholdDays,
    referenceDate,
    units,
  ]);

  const handleExportCsv = () => {
    if (subTab === 'cardex' && cardexData.item) {
      downloadCsv(
        `cardex_${cardexData.item.sku}.csv`,
        ['التاريخ', 'المستودع', 'نوع الحركة', 'رقم المستند', 'وارد', 'منصرف', 'الرصيد التراكمي', 'التكلفة'],
        [
          ['2026-01-01', 'رصيد بداية الفترة', 'رصيد افتتاحي', 'OPEN', cardexData.openingQty, 0, cardexData.openingQty, cardexData.item.costPrice],
          ...cardexData.rows.map((r) => [
            r.date,
            r.warehouseName,
            r.typeLabel,
            r.docNo,
            r.qtyIn,
            r.qtyOut,
            r.runningQty,
            r.unitCost.toFixed(2),
          ]),
        ]
      );
    } else if (subTab === 'warehouse_balances') {
      downloadCsv(
        'warehouse_stock_valuation.csv',
        ['المستودع', 'SKU', 'الصنف', 'الرصيد', 'الوحدة', 'متوسط التكلفة', 'القيمة المخزنية'],
        stockValuation.rows.map((r) => [
          r.wh?.nameAr ?? '',
          r.item?.sku ?? '',
          r.item?.nameAr ?? '',
          r.quantityOnHand,
          r.unit?.nameAr ?? '',
          r.wacCost.toFixed(2),
          r.totalValue.toFixed(2),
        ])
      );
    } else if (subTab === 'stagnant_items') {
      downloadCsv(
        `stagnant_items_${stagnantThresholdDays}d.csv`,
        ['SKU', 'الصنف', 'الرصيد المتاح', 'آخر بيع', 'أيام الركود', 'رأس المال المجمد'],
        stagnantReport.rows.map((r) => [
          r.item.sku,
          r.item.nameAr,
          r.qtyOnHand,
          r.lastSaleDate ?? 'لم يُبع منذ الافتتاح',
          r.daysStagnant,
          r.tiedUpCapital.toFixed(2),
        ])
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(
            [
              { id: 'cardex', label: 'كاردكس الصنف (حركة الصنف التفصيلية)' },
              { id: 'warehouse_balances', label: 'أرصدة المستودعات الحالية والتقييم' },
              { id: 'stagnant_items', label: 'تقرير الأصناف الراكدة' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
          >
            <option value="all">جميع المستودعات</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.nameAr}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* 1. Item Cardex */}
      {subTab === 'cardex' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">اختر الصنف:</label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg min-w-72"
              >
                {stockItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.sku} — {it.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {cardexData.item && (
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span>
                  الرصيد الافتتاحي:{' '}
                  <strong className="font-mono text-slate-900" dir="ltr">
                    {cardexData.openingQty}
                  </strong>
                </span>
                <span>
                  إجمالي الوارد:{' '}
                  <strong className="font-mono text-emerald-700" dir="ltr">
                    +{cardexData.totalIn}
                  </strong>
                </span>
                <span>
                  إجمالي المنصرف:{' '}
                  <strong className="font-mono text-red-700" dir="ltr">
                    -{cardexData.totalOut}
                  </strong>
                </span>
                <span>
                  الرصيد الحالي:{' '}
                  <strong className="font-mono text-emerald-700" dir="ltr">
                    {cardexData.closingQty} {cardexData.baseUnitName}
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4">نوع الحركة</th>
                    <th className="py-3 px-4">رقم المستند</th>
                    <th className="py-3 px-4 text-left">وارد (+)</th>
                    <th className="py-3 px-4 text-left">منصرف (-)</th>
                    <th className="py-3 px-4 text-left">الرصيد التراكمي</th>
                    <th className="py-3 px-4 text-left">التكلفة</th>
                    <th className="py-3 px-4">القيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70 font-medium text-slate-700">
                    <td className="py-2.5 px-4 font-mono">2026-01-01</td>
                    <td className="py-2.5 px-4">
                      {selectedWarehouseId === 'all'
                        ? 'كل المستودعات'
                        : warehouses.find((w) => w.id === selectedWarehouseId)?.nameAr}
                    </td>
                    <td className="py-2.5 px-4">رصيد افتتاحي / بداية الفترة</td>
                    <td className="py-2.5 px-4 font-mono">OPEN-2026</td>
                    <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                      —
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                      —
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-900" dir="ltr">
                      {cardexData.openingQty}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                      {cardexData.item?.costPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">—</td>
                  </tr>

                  {cardexData.rows.map((row, idx) => (
                    <tr key={`${row.docNo}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-500">{row.date}</td>
                      <td className="py-2.5 px-4 text-slate-700">{row.warehouseName}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {row.typeLabel}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">
                        {row.docNo}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-semibold text-emerald-700 tabular-nums"
                        dir="ltr"
                      >
                        {row.qtyIn > 0 ? `+${row.qtyIn}` : '—'}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-semibold text-red-700 tabular-nums"
                        dir="ltr"
                      >
                        {row.qtyOut > 0 ? `-${row.qtyOut}` : '—'}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-bold text-slate-900 tabular-nums"
                        dir="ltr"
                      >
                        {row.runningQty}
                      </td>
                      <td className="py-2.5 px-4 text-left font-mono text-slate-600 tabular-nums" dir="ltr">
                        {row.unitCost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4">
                        {row.journalEntryId ? (
                          <button
                            type="button"
                            onClick={() => onViewJournalEntry(row.journalEntryId)}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>عرض القيد</span>
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}

                  {cardexData.rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        لا توجد حركات فواتير أو تسويات مسجلة لهذا الصنف حتى الآن (الرصيد الافتتاحي فقط).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Current Warehouse Stock Valuation */}
      {subTab === 'warehouse_balances' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
            <div className="p-4">
              <div className="text-xs text-slate-500">إجمالي القيمة المخزنية بالتكلفة (WAC)</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
                {stockValuation.totalValue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">عدد الوحدات المتوفرة</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900" dir="ltr">
                {stockValuation.totalUnits.toLocaleString('en-US')}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">أصناف عند حد إعادة الطلب</div>
              <div
                className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                  stockValuation.lowStockCount > 0 ? 'text-red-700' : 'text-emerald-700'
                }`}
              >
                {stockValuation.lowStockCount}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">الصنف</th>
                    <th className="py-3 px-4 text-left">الكمية المتاحة</th>
                    <th className="py-3 px-4">الوحدة</th>
                    <th className="py-3 px-4 text-left">التكلفة (WAC)</th>
                    <th className="py-3 px-4 text-left">إجمالي القيمة</th>
                    <th className="py-3 px-4 text-left">النسبة %</th>
                    <th className="py-3 px-4">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockValuation.rows.map((r) => {
                    const share =
                      stockValuation.totalValue > 0
                        ? (r.totalValue / stockValuation.totalValue) * 100
                        : 0;
                    return (
                      <tr key={`${r.warehouseId}-${r.itemId}`} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 text-slate-700">{r.wh?.nameAr ?? '—'}</td>
                        <td className="py-2.5 px-4 font-mono text-emerald-700 font-semibold">
                          {r.item?.sku ?? '—'}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {r.item?.nameAr ?? '—'}
                        </td>
                        <td className="py-2.5 px-4 text-left font-mono font-bold tabular-nums" dir="ltr">
                          {r.quantityOnHand.toLocaleString('en-US')}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">{r.unit?.nameAr ?? '—'}</td>
                        <td className="py-2.5 px-4 text-left font-mono tabular-nums" dir="ltr">
                          {r.wacCost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums" dir="ltr">
                          {r.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-left font-mono text-slate-500 tabular-nums" dir="ltr">
                          {share.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-medium ${
                              r.isLow ? 'text-red-700' : 'text-emerald-700'
                            }`}
                          >
                            {r.isLow ? 'إعادة طلب' : 'متوفر'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Stagnant / Slow-Moving Items */}
      {subTab === 'stagnant_items' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-700">عتبة الركود (بدون مبيعات لمدة):</span>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {[30, 60, 90, 180].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setStagnantThresholdDays(d)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      stagnantThresholdDays === d
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d}+ يوم
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">تاريخ التقييم:</span>
                <input
                  type="date"
                  value={referenceDate}
                  onChange={(e) => setReferenceDate(e.target.value)}
                  dir="ltr"
                  className="px-2.5 py-1 font-mono text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="text-xs text-slate-600">
              رأس المال المجمد بالبضاعة الراكدة:{' '}
              <strong className="font-mono text-red-700" dir="ltr">
                {stagnantReport.totalStagnantCapital.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </strong>{' '}
              ({stagnantReport.stagnantSharePercent.toFixed(1)}% من إجمالي المخزون)
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">اسم الصنف</th>
                    <th className="py-3 px-4 text-left">الكمية الراكدة</th>
                    <th className="py-3 px-4">الوحدة</th>
                    <th className="py-3 px-4">تاريخ آخر بيع</th>
                    <th className="py-3 px-4 text-left">أيام التوقف</th>
                    <th className="py-3 px-4 text-left">رأس المال المجمد</th>
                    <th className="py-3 px-4">التوصية الإدارية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stagnantReport.rows.map((r) => (
                    <tr key={r.item.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                        {r.item.sku}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {r.item.nameAr}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold tabular-nums" dir="ltr">
                        {r.qtyOnHand.toLocaleString('en-US')}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{r.unitName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {r.lastSaleDate ?? 'لا توجد مبيعات مسجلة'}
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-semibold text-amber-700 tabular-nums" dir="ltr">
                        {r.daysStagnant} يوم
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-red-700 tabular-nums" dir="ltr">
                        {r.tiedUpCapital.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {r.daysStagnant > 120
                          ? 'تصفية عاجلة / خصم ترويجي لتسييل السيولة'
                          : 'إيقاف طلبات الشراء ومراجعة التسعير'}
                      </td>
                    </tr>
                  ))}
                  {stagnantReport.rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-slate-500">
                        لا توجد أصناف راكدة تجاوزت {stagnantThresholdDays} يوماً بدون مبيعات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
