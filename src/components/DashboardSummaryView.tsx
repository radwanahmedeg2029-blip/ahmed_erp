import { useMemo, useState } from 'react';
import { ArrowUpLeft, BookOpen } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ActiveTab,
  ChartAccount,
  Customer,
  Item,
  JournalEntry,
  PurchaseInvoice,
  SalesInvoice,
  Supplier,
  Unit,
  Voucher,
  Warehouse,
  WarehouseStock,
} from '../types/erp';

interface DashboardSummaryViewProps {
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  items: Item[];
  units: Unit[];
  warehouses: Warehouse[];
  warehouseStocks: WarehouseStock[];
  salesInvoices: SalesInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  customers: Customer[];
  suppliers: Supplier[];
  vouchers: Voucher[];
  onNavigate: (tab: ActiveTab) => void;
  onViewJournalEntry: (entryId: string) => void;
}

type TaxBasis = 'gross' | 'net';
type ChartMode = 'bar' | 'area';
type ForecastHorizon = 30 | 60 | 90;
type ForecastFlowFilter = 'all' | 'inflow' | 'outflow';
type AlertScope = 'warehouse' | 'company';
type AlertThresholdMode = 'strict' | 'near';

const ARABIC_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const formatCurrency = (val: number) =>
  val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatQty = (val: number) =>
  val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

function parseIsoUtc(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y || 2026, (m || 1) - 1, d || 1);
}

function addDaysIso(dateStr: string, days: number): string {
  const ms = parseIsoUtc(dateStr) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function diffDaysIso(fromDateStr: string, toDateStr: string): number {
  return Math.round((parseIsoUtc(toDateStr) - parseIsoUtc(fromDateStr)) / 86_400_000);
}

interface TrendPoint {
  monthKey: string;
  monthLabel: string;
  sales: number;
  purchases: number;
  grossProfit: number;
  salesCount: number;
  purchasesCount: number;
}

interface CustomTrendTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    payload?: TrendPoint;
  }>;
}

function CustomTrendTooltip({ active, payload }: CustomTrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      className="bg-white/95 backdrop-blur-sm border border-slate-200/90 rounded-xl p-3.5 shadow-lg text-xs space-y-1.5 min-w-[210px]"
      dir="rtl"
    >
      <div className="font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex items-center justify-between gap-4">
        <span>{point.monthLabel}</span>
        <span className="text-[11px] font-normal text-slate-400 font-mono" dir="ltr">
          {point.monthKey}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">صافي المبيعات ({point.salesCount})</span>
        <span className="font-mono tabular-nums font-semibold text-emerald-700" dir="ltr">
          {formatCurrency(point.sales)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-600">صافي المشتريات ({point.purchasesCount})</span>
        <span className="font-mono tabular-nums font-semibold text-slate-900" dir="ltr">
          {formatCurrency(point.purchases)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1">
        <span className="text-slate-600">مجمل الربح</span>
        <span
          className={`font-mono tabular-nums font-bold ${
            point.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}
          dir="ltr"
        >
          {formatCurrency(point.grossProfit)}
        </span>
      </div>
    </div>
  );
}

export function DashboardSummaryView({
  accounts,
  journalEntries,
  items,
  units,
  warehouses,
  warehouseStocks,
  salesInvoices,
  purchaseInvoices,
  customers,
  suppliers,
  vouchers,
  onNavigate,
  onViewJournalEntry,
}: DashboardSummaryViewProps) {
  const [taxBasis, setTaxBasis] = useState<TaxBasis>('net');
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(60);
  const [forecastAsOfDate, setForecastAsOfDate] = useState<string>('2026-11-13');
  const [forecastFlowFilter, setForecastFlowFilter] = useState<ForecastFlowFilter>('all');
  const [alertScope, setAlertScope] = useState<AlertScope>('warehouse');
  const [alertThresholdMode, setAlertThresholdMode] = useState<AlertThresholdMode>('strict');

  // 1) Total Sales vs Purchases Aggregation
  const tradeMetrics = useMemo(() => {
    const pickAmount = (inv: { subtotal: number; totalAmount: number }) =>
      taxBasis === 'gross' ? inv.totalAmount : inv.subtotal;

    let grossSales = 0;
    let salesReturns = 0;
    let salesCount = 0;
    let salesReturnCount = 0;
    let cashSalesNet = 0;
    let creditSalesNet = 0;
    let totalCogs = 0;
    let returnedCogs = 0;

    for (const inv of salesInvoices) {
      const amt = pickAmount(inv);
      if (inv.invoiceType === 'sale') {
        grossSales += amt;
        salesCount += 1;
        totalCogs += inv.totalCogs;
        if (inv.paymentMode === 'cash') cashSalesNet += amt;
        else creditSalesNet += amt;
      } else {
        salesReturns += amt;
        salesReturnCount += 1;
        returnedCogs += inv.totalCogs;
        if (inv.paymentMode === 'cash') cashSalesNet -= amt;
        else creditSalesNet -= amt;
      }
    }

    let grossPurchases = 0;
    let purchaseReturns = 0;
    let purchaseCount = 0;
    let purchaseReturnCount = 0;
    let cashPurchasesNet = 0;
    let creditPurchasesNet = 0;

    for (const inv of purchaseInvoices) {
      const amt = pickAmount(inv);
      if (inv.invoiceType === 'purchase') {
        grossPurchases += amt;
        purchaseCount += 1;
        if (inv.paymentMode === 'cash') cashPurchasesNet += amt;
        else creditPurchasesNet += amt;
      } else {
        purchaseReturns += amt;
        purchaseReturnCount += 1;
        if (inv.paymentMode === 'cash') cashPurchasesNet -= amt;
        else creditPurchasesNet -= amt;
      }
    }

    const netSales = grossSales - salesReturns;
    const netPurchases = grossPurchases - purchaseReturns;
    const netCogs = totalCogs - returnedCogs;
    const grossProfit = netSales - netCogs;
    const grossMarginPct = netSales > 0 ? (grossProfit / netSales) * 100 : 0;
    const maxScale = Math.max(netSales, netPurchases, Math.abs(grossProfit), 1);

    return {
      grossSales,
      salesReturns,
      netSales,
      salesCount,
      salesReturnCount,
      cashSalesNet,
      creditSalesNet,
      grossPurchases,
      purchaseReturns,
      netPurchases,
      purchaseCount,
      purchaseReturnCount,
      cashPurchasesNet,
      creditPurchasesNet,
      netCogs,
      grossProfit,
      grossMarginPct,
      maxScale,
    };
  }, [salesInvoices, purchaseInvoices, taxBasis]);

  // 2) Current Inventory Valuation (Live Physical Stock * WAC Item Cost)
  const inventoryMetrics = useMemo(() => {
    const itemMap = new Map(items.map((i) => [i.id, i]));
    let totalPhysicalValue = 0;
    let totalUnitsOnHand = 0;
    const itemQtyTotals = new Map<string, number>();

    const byWarehouse = warehouses
      .filter((w) => w.isActive)
      .map((wh) => {
        const stocks = warehouseStocks.filter((s) => s.warehouseId === wh.id);
        let whValue = 0;
        let whQty = 0;
        let activeSkus = 0;
        for (const s of stocks) {
          const item = itemMap.get(s.itemId);
          if (!item || item.itemType !== 'stock') continue;
          const val = s.quantityOnHand * item.costPrice;
          whValue += val;
          whQty += s.quantityOnHand;
          if (s.quantityOnHand > 0) activeSkus += 1;
          itemQtyTotals.set(item.id, (itemQtyTotals.get(item.id) ?? 0) + s.quantityOnHand);
        }
        totalPhysicalValue += whValue;
        totalUnitsOnHand += whQty;
        return {
          warehouse: wh,
          value: whValue,
          qty: whQty,
          activeSkus,
        };
      })
      .sort((a, b) => b.value - a.value);

    const lowStockItems = items
      .filter((item) => item.itemType === 'stock' && item.isActive)
      .map((item) => ({
        item,
        onHand: itemQtyTotals.get(item.id) ?? 0,
      }))
      .filter((row) => row.onHand <= row.item.minStockLevel)
      .sort((a, b) => a.onHand - b.onHand);

    const glInventoryBalance = accounts.find((a) => a.code === '1103')?.currentBalance ?? 0;

    return {
      totalPhysicalValue,
      totalUnitsOnHand,
      glInventoryBalance,
      byWarehouse,
      lowStockItems,
    };
  }, [items, warehouses, warehouseStocks, accounts]);

  // 3) Financial Position & Net Operating Profit from Posted Journal Entries
  const financialMetrics = useMemo(() => {
    const postable = accounts.filter((a) => a.isPostable);
    let revenues = 0;
    let expenses = 0;

    for (const acc of postable) {
      if (acc.accountType !== 'revenue' && acc.accountType !== 'expense') continue;
      let val = 0;
      for (const je of journalEntries) {
        if (je.status !== 'posted') continue;
        for (const line of je.lines) {
          if (line.accountId !== acc.id) continue;
          val += acc.accountType === 'revenue' ? line.credit - line.debit : line.debit - line.credit;
        }
      }
      if (acc.accountType === 'revenue') revenues += val;
      else expenses += val;
    }

    const netProfit = revenues - expenses;
    const totalAssets = accounts.find((a) => a.code === '1')?.currentBalance ?? 0;
    const totalLiabilities = accounts.find((a) => a.code === '2')?.currentBalance ?? 0;
    const baseEquity = accounts.find((a) => a.code === '3')?.currentBalance ?? 0;
    const cashBalance = accounts.find((a) => a.code === '1101')?.currentBalance ?? 0;
    const totalReceivables = customers.reduce((sum, c) => sum + c.currentBalance, 0);
    const totalPayables = suppliers.reduce((sum, s) => sum + s.currentBalance, 0);

    return {
      revenues,
      expenses,
      netProfit,
      totalAssets,
      totalLiabilities,
      totalEquityWithProfit: baseEquity + netProfit,
      cashBalance,
      totalReceivables,
      totalPayables,
    };
  }, [accounts, journalEntries, customers, suppliers]);

  // 4) Unified Recent Activity Feed (Sales, Purchases, Vouchers)
  const recentActivity = useMemo(() => {
    const customerMap = new Map(customers.map((c) => [c.id, c.nameAr]));
    const supplierMap = new Map(suppliers.map((s) => [s.id, s.nameAr]));

    type FeedRow = {
      id: string;
      date: string;
      refNo: string;
      kindLabel: string;
      partyName: string;
      paymentLabel: string;
      amount: number;
      directionTone: 'in' | 'out' | 'neutral';
      journalEntryId: string;
      targetTab: ActiveTab;
    };

    const rows: FeedRow[] = [];

    for (const inv of salesInvoices) {
      const isSale = inv.invoiceType === 'sale';
      rows.push({
        id: `s-${inv.id}`,
        date: inv.invoiceDate,
        refNo: inv.invoiceNo,
        kindLabel: isSale ? 'فاتورة مبيعات' : 'مرتجع مبيعات',
        partyName: customerMap.get(inv.customerId) ?? 'عميل',
        paymentLabel: inv.paymentMode === 'cash' ? 'نقدي' : 'آجل',
        amount: inv.totalAmount,
        directionTone: isSale ? 'in' : 'out',
        journalEntryId: inv.journalEntryId,
        targetTab: 'sales',
      });
    }

    for (const inv of purchaseInvoices) {
      const isPur = inv.invoiceType === 'purchase';
      rows.push({
        id: `p-${inv.id}`,
        date: inv.invoiceDate,
        refNo: inv.invoiceNo,
        kindLabel: isPur ? 'فاتورة مشتريات' : 'مرتجع مشتريات',
        partyName: supplierMap.get(inv.supplierId) ?? 'مورد',
        paymentLabel: inv.paymentMode === 'cash' ? 'نقدي' : 'آجل',
        amount: inv.totalAmount,
        directionTone: isPur ? 'out' : 'in',
        journalEntryId: inv.journalEntryId,
        targetTab: 'purchases',
      });
    }

    for (const v of vouchers) {
      const isReceipt = v.voucherType === 'receipt';
      rows.push({
        id: `v-${v.id}`,
        date: v.voucherDate,
        refNo: v.voucherNo,
        kindLabel: isReceipt ? 'سند قبض' : 'سند صرف',
        partyName: v.partyLabel,
        paymentLabel:
          v.paymentMethod === 'cash'
            ? 'نقداً'
            : v.paymentMethod === 'bank_transfer'
              ? 'تحويل بنكي'
              : v.paymentMethod === 'cheque'
                ? 'شيك'
                : 'نقطة بيع',
        amount: v.amount,
        directionTone: isReceipt ? 'in' : 'out',
        journalEntryId: v.journalEntryId,
        targetTab: 'vouchers',
      });
    }

    return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  }, [salesInvoices, purchaseInvoices, vouchers, customers, suppliers]);

  // 4b) Past 6 Months Sales & Purchases Trend Series for Recharts
  const sixMonthTrends = useMemo<TrendPoint[]>(() => {
    const pickAmount = (inv: { subtotal: number; totalAmount: number }) =>
      taxBasis === 'gross' ? inv.totalAmount : inv.subtotal;

    // Determine anchor month from latest invoice or forecastAsOfDate
    const allDates = [
      ...salesInvoices.map((i) => i.invoiceDate),
      ...purchaseInvoices.map((i) => i.invoiceDate),
      forecastAsOfDate,
    ].sort();
    const latestDate = allDates[allDates.length - 1] ?? '2026-11-13';
    const [anchorYear, anchorMonth] = latestDate.slice(0, 7).split('-').map(Number);

    const monthSlots: { key: string; label: string }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const d = new Date(Date.UTC(anchorYear || 2026, (anchorMonth || 11) - 1 - offset, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      monthSlots.push({
        key,
        label: `${ARABIC_MONTH_NAMES[m]} ${y}`,
      });
    }

    const bucketMap = new Map<
      string,
      { sales: number; purchases: number; cogs: number; salesCount: number; purchasesCount: number }
    >();
    for (const slot of monthSlots) {
      bucketMap.set(slot.key, { sales: 0, purchases: 0, cogs: 0, salesCount: 0, purchasesCount: 0 });
    }

    for (const inv of salesInvoices) {
      const mKey = inv.invoiceDate.slice(0, 7);
      const entry = bucketMap.get(mKey);
      if (!entry) continue;
      const amt = pickAmount(inv);
      if (inv.invoiceType === 'sale') {
        entry.sales += amt;
        entry.cogs += inv.totalCogs;
        entry.salesCount += 1;
      } else {
        entry.sales -= amt;
        entry.cogs -= inv.totalCogs;
      }
    }

    for (const inv of purchaseInvoices) {
      const mKey = inv.invoiceDate.slice(0, 7);
      const entry = bucketMap.get(mKey);
      if (!entry) continue;
      const amt = pickAmount(inv);
      if (inv.invoiceType === 'purchase') {
        entry.purchases += amt;
        entry.purchasesCount += 1;
      } else {
        entry.purchases -= amt;
      }
    }

    return monthSlots.map((slot) => {
      const agg = bucketMap.get(slot.key)!;
      return {
        monthKey: slot.key,
        monthLabel: slot.label,
        sales: Number(agg.sales.toFixed(2)),
        purchases: Number(agg.purchases.toFixed(2)),
        grossProfit: Number((agg.sales - agg.cogs).toFixed(2)),
        salesCount: agg.salesCount,
        purchasesCount: agg.purchasesCount,
      };
    });
  }, [salesInvoices, purchaseInvoices, taxBasis, forecastAsOfDate]);

  // 5) Cash Flow Forecasting (based on due dates of unpaid Credit Sales & Credit Purchase Invoices)
  const cashFlowForecast = useMemo(() => {
    type ForecastEvent = {
      id: string;
      docNo: string;
      invoiceDate: string;
      dueDate: string;
      termsDays: number;
      daysUntilDue: number;
      partyName: string;
      amount: number;
      flowKind: 'inflow' | 'outflow';
      journalEntryId: string;
      targetTab: ActiveTab;
    };

    const events: ForecastEvent[] = [];
    let unscheduledReceivables = 0;
    let unscheduledPayables = 0;

    // Allocate open receivable balance across newest credit sales invoices first
    for (const cust of customers) {
      let remaining = Math.max(0, cust.currentBalance);
      const custCreditSales = salesInvoices
        .filter(
          (i) =>
            i.customerId === cust.id &&
            i.invoiceType === 'sale' &&
            i.paymentMode === 'credit'
        )
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

      for (const inv of custCreditSales) {
        if (remaining <= 0) break;
        const openAmt = Number(Math.min(remaining, inv.totalAmount).toFixed(2));
        remaining = Number((remaining - openAmt).toFixed(2));
        if (openAmt <= 0) continue;
        const terms = cust.paymentTermsDays || 0;
        const dueDate = addDaysIso(inv.invoiceDate, terms);
        events.push({
          id: `cf-in-${inv.id}`,
          docNo: inv.invoiceNo,
          invoiceDate: inv.invoiceDate,
          dueDate,
          termsDays: terms,
          daysUntilDue: diffDaysIso(forecastAsOfDate, dueDate),
          partyName: cust.nameAr,
          amount: openAmt,
          flowKind: 'inflow',
          journalEntryId: inv.journalEntryId,
          targetTab: 'sales',
        });
      }

      if (remaining > 0) {
        unscheduledReceivables += remaining;
      }
    }

    // Allocate open payable balance across newest credit purchase invoices first
    for (const sup of suppliers) {
      let remaining = Math.max(0, sup.currentBalance);
      const supCreditPurchases = purchaseInvoices
        .filter(
          (i) =>
            i.supplierId === sup.id &&
            i.invoiceType === 'purchase' &&
            i.paymentMode === 'credit'
        )
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

      for (const inv of supCreditPurchases) {
        if (remaining <= 0) break;
        const openAmt = Number(Math.min(remaining, inv.totalAmount).toFixed(2));
        remaining = Number((remaining - openAmt).toFixed(2));
        if (openAmt <= 0) continue;
        const terms = sup.paymentTermsDays || 0;
        const dueDate = addDaysIso(inv.invoiceDate, terms);
        events.push({
          id: `cf-out-${inv.id}`,
          docNo: inv.invoiceNo,
          invoiceDate: inv.invoiceDate,
          dueDate,
          termsDays: terms,
          daysUntilDue: diffDaysIso(forecastAsOfDate, dueDate),
          partyName: sup.nameAr,
          amount: openAmt,
          flowKind: 'outflow',
          journalEntryId: inv.journalEntryId,
          targetTab: 'purchases',
        });
      }

      if (remaining > 0) {
        unscheduledPayables += remaining;
      }
    }

    const horizonEvents = events
      .filter((e) => e.daysUntilDue <= forecastHorizon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const beyondHorizonCount = events.filter((e) => e.daysUntilDue > forecastHorizon).length;

    const bucketDefs: { key: string; label: string; minDay: number; maxDay: number }[] = [
      { key: 'overdue', label: 'مستحقة / متأخرة الآن', minDay: -99999, maxDay: 0 },
      { key: 'b1_15', label: '1 – 15 يوماً', minDay: 1, maxDay: 15 },
      { key: 'b16_30', label: '16 – 30 يوماً', minDay: 16, maxDay: 30 },
    ];
    if (forecastHorizon >= 60) {
      bucketDefs.push({ key: 'b31_60', label: '31 – 60 يوماً', minDay: 31, maxDay: 60 });
    }
    if (forecastHorizon >= 90) {
      bucketDefs.push({ key: 'b61_90', label: '61 – 90 يوماً', minDay: 61, maxDay: 90 });
    }

    let runningCash = financialMetrics.cashBalance;
    const buckets = bucketDefs.map((b) => {
      let inflows = 0;
      let outflows = 0;
      let count = 0;
      for (const ev of horizonEvents) {
        if (ev.daysUntilDue >= b.minDay && ev.daysUntilDue <= b.maxDay) {
          if (ev.flowKind === 'inflow') inflows += ev.amount;
          else outflows += ev.amount;
          count += 1;
        }
      }
      const net = Number((inflows - outflows).toFixed(2));
      runningCash = Number((runningCash + net).toFixed(2));
      return {
        key: b.key,
        label: b.label,
        inflows: Number(inflows.toFixed(2)),
        outflows: Number(outflows.toFixed(2)),
        net,
        projectedCashAfter: runningCash,
        count,
      };
    });

    const expectedInflows = Number(
      horizonEvents
        .filter((e) => e.flowKind === 'inflow')
        .reduce((sum, e) => sum + e.amount, 0)
        .toFixed(2)
    );
    const expectedOutflows = Number(
      horizonEvents
        .filter((e) => e.flowKind === 'outflow')
        .reduce((sum, e) => sum + e.amount, 0)
        .toFixed(2)
    );
    const netCashFlow = Number((expectedInflows - expectedOutflows).toFixed(2));
    const projectedEndingCash = Number((financialMetrics.cashBalance + netCashFlow).toFixed(2));
    const maxBucketValue = Math.max(
      ...buckets.flatMap((b) => [b.inflows, b.outflows]),
      1
    );

    const filteredEvents =
      forecastFlowFilter === 'all'
        ? horizonEvents
        : horizonEvents.filter((e) => e.flowKind === forecastFlowFilter);

    return {
      buckets,
      filteredEvents,
      totalScheduledCount: horizonEvents.length,
      beyondHorizonCount,
      expectedInflows,
      expectedOutflows,
      netCashFlow,
      projectedEndingCash,
      maxBucketValue,
      unscheduledReceivables: Number(unscheduledReceivables.toFixed(2)),
      unscheduledPayables: Number(unscheduledPayables.toFixed(2)),
    };
  }, [
    customers,
    suppliers,
    salesInvoices,
    purchaseInvoices,
    forecastAsOfDate,
    forecastHorizon,
    forecastFlowFilter,
    financialMetrics.cashBalance,
  ]);

  // 6) Inventory Reorder Alerts (تنبيهات المخزون)
  const inventoryAlerts = useMemo(() => {
    const unitMap = new Map(units.map((u) => [u.id, u.symbol || u.nameAr]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const itemMap = new Map(items.map((i) => [i.id, i]));

    type AlertRow = {
      key: string;
      item: Item;
      unitLabel: string;
      locationName: string;
      locationCode: string;
      onHand: number;
      minStockLevel: number;
      deficit: number;
      suggestedOrderQty: number;
      estimatedReplenishCost: number;
      severity: 'out_of_stock' | 'at_reorder' | 'near_reorder';
    };

    const rawWarehouseAlerts: AlertRow[] = [];
    const seenPairs = new Set<string>();

    // Check every warehouse stock entry for active stock items
    for (const stock of warehouseStocks) {
      const item = itemMap.get(stock.itemId);
      const wh = warehouseMap.get(stock.warehouseId);
      if (!item || !wh || !item.isActive || !wh.isActive || item.itemType !== 'stock') continue;
      if (item.minStockLevel <= 0) continue;

      seenPairs.add(`${wh.id}::${item.id}`);
      const nearCeiling = item.minStockLevel * 1.25;
      const isStrict = stock.quantityOnHand <= item.minStockLevel;
      const isNear = !isStrict && stock.quantityOnHand <= nearCeiling;

      if (isStrict || (alertThresholdMode === 'near' && isNear)) {
        const deficit = Math.max(0, Number((item.minStockLevel - stock.quantityOnHand).toFixed(2)));
        const targetStock = item.minStockLevel * 2;
        const suggestedOrderQty = Math.max(0, Number((targetStock - stock.quantityOnHand).toFixed(2)));
        rawWarehouseAlerts.push({
          key: `wh-${wh.id}-${item.id}`,
          item,
          unitLabel: unitMap.get(item.baseUnitId) ?? 'وحدة',
          locationName: wh.nameAr,
          locationCode: wh.code,
          onHand: stock.quantityOnHand,
          minStockLevel: item.minStockLevel,
          deficit,
          suggestedOrderQty,
          estimatedReplenishCost: Number((suggestedOrderQty * item.costPrice).toFixed(2)),
          severity:
            stock.quantityOnHand <= 0
              ? 'out_of_stock'
              : isStrict
                ? 'at_reorder'
                : 'near_reorder',
        });
      }
    }

    // Also include active stock items with 0 stock in their default warehouse if not present in warehouseStocks
    for (const item of items) {
      if (!item.isActive || item.itemType !== 'stock' || item.minStockLevel <= 0) continue;
      if (!item.defaultWarehouseId) continue;
      const wh = warehouseMap.get(item.defaultWarehouseId);
      if (!wh || !wh.isActive) continue;
      if (seenPairs.has(`${wh.id}::${item.id}`)) continue;

      const suggestedOrderQty = item.minStockLevel * 2;
      rawWarehouseAlerts.push({
        key: `wh-missing-${wh.id}-${item.id}`,
        item,
        unitLabel: unitMap.get(item.baseUnitId) ?? 'وحدة',
        locationName: wh.nameAr,
        locationCode: wh.code,
        onHand: 0,
        minStockLevel: item.minStockLevel,
        deficit: item.minStockLevel,
        suggestedOrderQty,
        estimatedReplenishCost: Number((suggestedOrderQty * item.costPrice).toFixed(2)),
        severity: 'out_of_stock',
      });
    }

    // Company-wide totals per item
    const companyAlerts: AlertRow[] = [];
    for (const item of items) {
      if (!item.isActive || item.itemType !== 'stock' || item.minStockLevel <= 0) continue;
      const totalOnHand = warehouseStocks
        .filter((s) => s.itemId === item.id)
        .reduce((sum, s) => sum + s.quantityOnHand, 0);
      const nearCeiling = item.minStockLevel * 1.25;
      const isStrict = totalOnHand <= item.minStockLevel;
      const isNear = !isStrict && totalOnHand <= nearCeiling;

      if (isStrict || (alertThresholdMode === 'near' && isNear)) {
        const deficit = Math.max(0, Number((item.minStockLevel - totalOnHand).toFixed(2)));
        const suggestedOrderQty = Math.max(0, Number((item.minStockLevel * 2 - totalOnHand).toFixed(2)));
        companyAlerts.push({
          key: `co-${item.id}`,
          item,
          unitLabel: unitMap.get(item.baseUnitId) ?? 'وحدة',
          locationName: 'إجمالي كافة المستودعات',
          locationCode: 'ALL',
          onHand: totalOnHand,
          minStockLevel: item.minStockLevel,
          deficit,
          suggestedOrderQty,
          estimatedReplenishCost: Number((suggestedOrderQty * item.costPrice).toFixed(2)),
          severity:
            totalOnHand <= 0 ? 'out_of_stock' : isStrict ? 'at_reorder' : 'near_reorder',
        });
      }
    }

    const severityRank = { out_of_stock: 0, at_reorder: 1, near_reorder: 2 };
    const sortRows = (arr: AlertRow[]) =>
      arr.sort((a, b) => {
        const rankDiff = severityRank[a.severity] - severityRank[b.severity];
        if (rankDiff !== 0) return rankDiff;
        return b.deficit - a.deficit;
      });

    const activeRows = sortRows(alertScope === 'warehouse' ? rawWarehouseAlerts : companyAlerts);
    const strictWarehouseCount = rawWarehouseAlerts.filter(
      (r) => r.severity === 'out_of_stock' || r.severity === 'at_reorder'
    ).length;
    const outOfStockCount = activeRows.filter((r) => r.severity === 'out_of_stock').length;
    const atReorderCount = activeRows.filter((r) => r.severity === 'at_reorder').length;
    const totalEstimatedReplenish = Number(
      activeRows.reduce((sum, r) => sum + r.estimatedReplenishCost, 0).toFixed(2)
    );

    return {
      rows: activeRows,
      strictWarehouseCount,
      outOfStockCount,
      atReorderCount,
      totalEstimatedReplenish,
    };
  }, [items, units, warehouses, warehouseStocks, alertScope, alertThresholdMode]);

  return (
    <div className="space-y-6">
      {/* Toolbar: Section Context & Tax Basis Switch */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-950 tracking-tight">
            الملخص التنفيذي والمؤشرات المالية والمخزنية
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            قراءة لحظية مجمعة من فواتير المبيعات والمشتريات وأرصدة المستودعات والقيود المحاسبية المرحّلة
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setTaxBasis('net')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
              taxBasis === 'net'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            صافي قبل الضريبة
          </button>
          <button
            type="button"
            onClick={() => setTaxBasis('gross')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
              taxBasis === 'gross'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            شامل الضريبة
          </button>
        </div>
      </div>

      {/* 4-Card Primary Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('sales')}
          className="group bg-white border border-slate-200/90 hover:border-emerald-300 shadow-2xs hover:shadow-sm rounded-2xl p-5 text-right transition-all duration-150 flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-slate-500">صافي المبيعات</span>
            <ArrowUpLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
          <div className="text-[26px] leading-tight font-bold font-mono tabular-nums tracking-tight text-emerald-600" dir="ltr">
            {formatCurrency(tradeMetrics.netSales)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-mono tabular-nums">{tradeMetrics.salesCount} فاتورة بيع</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{tradeMetrics.salesReturnCount} مرتجع</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('purchases')}
          className="group bg-white border border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-sm rounded-2xl p-5 text-right transition-all duration-150 flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-slate-500">صافي المشتريات</span>
            <ArrowUpLeft className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
          <div className="text-[26px] leading-tight font-bold font-mono tabular-nums tracking-tight text-slate-950" dir="ltr">
            {formatCurrency(tradeMetrics.netPurchases)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-mono tabular-nums">{tradeMetrics.purchaseCount} فاتورة شراء</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {tradeMetrics.purchaseReturnCount} مرتجع
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory_reports')}
          className="group bg-white border border-slate-200/90 hover:border-amber-300 shadow-2xs hover:shadow-sm rounded-2xl p-5 text-right transition-all duration-150 flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-slate-500">قيمة المخزون الحالية</span>
            <ArrowUpLeft className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
          <div className="text-[26px] leading-tight font-bold font-mono tabular-nums tracking-tight text-amber-600" dir="ltr">
            {formatCurrency(inventoryMetrics.totalPhysicalValue)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span className="font-mono tabular-nums">
              {formatQty(inventoryMetrics.totalUnitsOnHand)} وحدة
            </span>
            <span aria-hidden="true">·</span>
            <span>{inventoryMetrics.byWarehouse.length} مستودعات</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('financial_reports')}
          className="group bg-white border border-slate-200/90 hover:border-emerald-300 shadow-2xs hover:shadow-sm rounded-2xl p-5 text-right transition-all duration-150 flex flex-col justify-between gap-3"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-xs font-medium text-slate-500">صافي الربح التشغيلي</span>
            <ArrowUpLeft className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
          </div>
          <div
            className={`text-[26px] leading-tight font-bold font-mono tabular-nums tracking-tight ${
              financialMetrics.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}
            dir="ltr"
          >
            {formatCurrency(financialMetrics.netProfit)}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
            <span>النقدية:</span>
            <span className="font-mono tabular-nums text-slate-800 font-semibold" dir="ltr">
              {formatCurrency(financialMetrics.cashBalance)}
            </span>
          </div>
        </button>
      </div>

      {/* Main 2-Column Visual Grid: Total Sales vs Purchases + Current Inventory Value */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Panel 1: 6-Month Sales vs Purchases Recharts Trend Chart (7 cols) */}
        <section className="lg:col-span-7 bg-white border border-slate-200/90 shadow-2xs rounded-2xl flex flex-col justify-between min-w-0 overflow-hidden">
          <div>
            <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  اتجاهات المبيعات والمشتريات (آخر 6 أشهر)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مقارنة شهرية تفاعلية لصافي المبيعات والمشتريات ومجمل الربح التراكمي
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setChartMode('bar')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                      chartMode === 'bar'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    أعمدة مقارنة
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('area')}
                    className={`px-3 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                      chartMode === 'area'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    منحنى الاتجاه
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('financial_reports')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
                >
                  قائمة الدخل
                </button>
              </div>
            </div>

            {/* Summary KPI Strip above Chart */}
            <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200/80 border-b border-slate-200/80 bg-slate-50/50">
              <div className="px-5 py-3.5">
                <div className="text-[11px] text-slate-500">إجمالي صافي المبيعات</div>
                <div className="text-sm font-bold font-mono tabular-nums text-emerald-700 mt-0.5" dir="ltr">
                  {formatCurrency(tradeMetrics.netSales)}
                </div>
              </div>
              <div className="px-5 py-3.5">
                <div className="text-[11px] text-slate-500">إجمالي صافي المشتريات</div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-950 mt-0.5" dir="ltr">
                  {formatCurrency(tradeMetrics.netPurchases)}
                </div>
              </div>
              <div className="px-5 py-3.5">
                <div className="text-[11px] text-slate-500">
                  مجمل الربح ({tradeMetrics.grossMarginPct.toFixed(1)}%)
                </div>
                <div
                  className={`text-sm font-bold font-mono tabular-nums mt-0.5 ${
                    tradeMetrics.grossProfit >= 0 ? 'text-amber-700' : 'text-rose-700'
                  }`}
                  dir="ltr"
                >
                  {formatCurrency(tradeMetrics.grossProfit)}
                </div>
              </div>
            </div>

            {/* Recharts Interactive Container */}
            <div className="p-6 min-w-0">
              <div className="h-72 w-full min-w-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === 'bar' ? (
                    <ComposedChart
                      data={sixMonthTrends}
                      margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={(val: number) =>
                          val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                        }
                      />
                      <Tooltip content={<CustomTrendTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                        iconType="circle"
                      />
                      <Bar
                        dataKey="sales"
                        name="صافي المبيعات"
                        fill="#059669"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={30}
                      />
                      <Bar
                        dataKey="purchases"
                        name="صافي المشتريات"
                        fill="#0d1526"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={30}
                      />
                      <Line
                        type="monotone"
                        dataKey="grossProfit"
                        name="مجمل الربح"
                        stroke="#d97706"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: '#d97706', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                      />
                    </ComposedChart>
                  ) : (
                    <AreaChart
                      data={sixMonthTrends}
                      margin={{ top: 10, right: 12, left: 4, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.24} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                        </linearGradient>
                        <linearGradient id="purchasesTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d1526" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="#0d1526" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="monthLabel"
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tickFormatter={(val: number) =>
                          val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val)
                        }
                      />
                      <Tooltip content={<CustomTrendTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                        iconType="circle"
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        name="صافي المبيعات"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fill="url(#salesTrendFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="purchases"
                        name="صافي المشتريات"
                        stroke="#0d1526"
                        strokeWidth={2}
                        fill="url(#purchasesTrendFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="grossProfit"
                        name="مجمل الربح"
                        stroke="#d97706"
                        strokeWidth={2}
                        fillOpacity={0}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hairline Split Matrix: Cash vs Credit */}
          <div className="border-t border-slate-200/80 grid grid-cols-2 divide-x divide-x-reverse divide-slate-200/80 bg-slate-50/30">
            <div className="px-6 py-4 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400">توزيع المبيعات</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">مبيعات نقدية</span>
                <span className="font-mono tabular-nums font-semibold text-slate-950" dir="ltr">
                  {formatCurrency(tradeMetrics.cashSalesNet)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">مبيعات آجلة</span>
                <span className="font-mono tabular-nums font-semibold text-slate-950" dir="ltr">
                  {formatCurrency(tradeMetrics.creditSalesNet)}
                </span>
              </div>
            </div>

            <div className="px-6 py-4 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400">توزيع المشتريات</div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">مشتريات نقدية</span>
                <span className="font-mono tabular-nums font-semibold text-slate-950" dir="ltr">
                  {formatCurrency(tradeMetrics.cashPurchasesNet)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">مشتريات آجلة</span>
                <span className="font-mono tabular-nums font-semibold text-slate-950" dir="ltr">
                  {formatCurrency(tradeMetrics.creditPurchasesNet)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Panel 2: Current Inventory Value by Warehouse (5 cols) */}
        <section className="lg:col-span-5 bg-white border border-slate-200/90 shadow-2xs rounded-2xl flex flex-col justify-between overflow-hidden">
          <div>
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-950">
                  تقييم المخزون الحالي حسب المستودع
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  توزيع الكميات والتكلفة المرجحة (WAC) عبر المستودعات
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('inventory_reports')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
              >
                كاردكس المخزون
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {inventoryMetrics.byWarehouse.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  لا توجد مستودعات نشطة مسجلة حالياً.
                </div>
              ) : (
                inventoryMetrics.byWarehouse.map((row) => {
                  const sharePct =
                    inventoryMetrics.totalPhysicalValue > 0
                      ? (row.value / inventoryMetrics.totalPhysicalValue) * 100
                      : 0;
                  return (
                    <div key={row.warehouse.id} className="px-6 py-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-950 truncate">
                            {row.warehouse.nameAr}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            <span className="font-mono tabular-nums">{row.activeSkus} صنف</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">
                              {formatQty(row.qty)} وحدة
                            </span>
                          </div>
                        </div>
                        <div className="text-left shrink-0">
                          <div
                            className="text-xs font-bold font-mono tabular-nums text-slate-950"
                            dir="ltr"
                          >
                            {formatCurrency(row.value)}
                          </div>
                          <div
                            className="text-[11px] font-mono tabular-nums text-slate-500"
                            dir="ltr"
                          >
                            {sharePct.toFixed(1)}%
                          </div>
                        </div>
                      </div>

                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.round(sharePct))}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/30 px-6 py-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">مطابقة حساب المخزون (1103)</span>
              <span className="font-mono tabular-nums font-semibold text-slate-950" dir="ltr">
                {formatCurrency(inventoryMetrics.glInventoryBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">تنبيهات حد الطلب بالمستودعات</span>
              <a
                href="#inventory-alerts"
                className={`font-mono tabular-nums font-semibold hover:underline ${
                  inventoryAlerts.strictWarehouseCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {inventoryAlerts.strictWarehouseCount > 0
                  ? `${inventoryAlerts.strictWarehouseCount} تنبيه يتطلب إعادة طلب`
                  : 'جميع الأرصدة آمنة'}
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Inventory Reorder Alerts Section (تنبيهات المخزون) */}
      <section
        id="inventory-alerts"
        className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              تنبيهات المخزون وحد إعادة الطلب (Reorder Level Alerts)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              رصد تلقائي للأصناف التي وصلت أرصدتها الحالية في المستودعات إلى حد الطلب أو دونه تمهيداً لإصدار أوامر الشراء
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
              <button
                type="button"
                onClick={() => setAlertScope('warehouse')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  alertScope === 'warehouse'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                حسب كل مستودع
              </button>
              <button
                type="button"
                onClick={() => setAlertScope('company')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  alertScope === 'company'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                إجمالي الشركة
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
              <button
                type="button"
                onClick={() => setAlertThresholdMode('strict')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  alertThresholdMode === 'strict'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                وصل لحد الطلب ({inventoryAlerts.outOfStockCount + inventoryAlerts.atReorderCount})
              </button>
              <button
                type="button"
                onClick={() => setAlertThresholdMode('near')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  alertThresholdMode === 'near'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                يشمل القريب (+25%)
              </button>
            </div>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200/80 border-b border-slate-200/80 bg-slate-50/50">
          <div className="px-6 py-3 flex items-center justify-between text-xs">
            <span className="text-slate-600">أصناف وصلت لحد الطلب</span>
            <span
              className={`font-mono tabular-nums font-bold ${
                inventoryAlerts.atReorderCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {inventoryAlerts.atReorderCount}
            </span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-xs">
            <span className="text-slate-600">أصناف رصيدها صفر (نفدت)</span>
            <span
              className={`font-mono tabular-nums font-bold ${
                inventoryAlerts.outOfStockCount > 0 ? 'text-rose-700' : 'text-slate-700'
              }`}
            >
              {inventoryAlerts.outOfStockCount}
            </span>
          </div>
          <div className="px-6 py-3 flex items-center justify-between text-xs">
            <span className="text-slate-600">التكلفة التقديرية لتعزيز المخزون</span>
            <span className="font-mono tabular-nums font-bold text-slate-950" dir="ltr">
              {formatCurrency(inventoryAlerts.totalEstimatedReplenish)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">الكود / الصنف</th>
                <th className="py-3 px-4">المستودع</th>
                <th className="py-3 px-4 text-left">الرصيد الحالي</th>
                <th className="py-3 px-4 text-left">حد الطلب</th>
                <th className="py-3 px-4 text-left">النقص عن الحد</th>
                <th className="py-3 px-4 text-left">كمية مقترحة للطلب</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {inventoryAlerts.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    لا توجد أصناف وصلت إلى حد إعادة الطلب وفق المعايير المحددة حالياً.
                  </td>
                </tr>
              ) : (
                inventoryAlerts.rows.map((alert) => {
                  const statusLabel =
                    alert.severity === 'out_of_stock'
                      ? 'نفد المخزون'
                      : alert.severity === 'at_reorder'
                        ? 'وصل لحد الطلب'
                        : 'قريب من حد الطلب';
                  const statusTone =
                    alert.severity === 'out_of_stock'
                      ? 'text-rose-700'
                      : alert.severity === 'at_reorder'
                        ? 'text-amber-700'
                        : 'text-slate-700';

                  return (
                    <tr key={alert.key} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-950">{alert.item.nameAr}</div>
                        <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                          {alert.item.sku} · {alert.item.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        <div>{alert.locationName}</div>
                        <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                          {alert.locationCode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-left font-mono tabular-nums font-bold text-slate-950 whitespace-nowrap">
                        {formatQty(alert.onHand)}{' '}
                        <span className="font-sans font-normal text-slate-500">
                          {alert.unitLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-left font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatQty(alert.minStockLevel)}{' '}
                        <span className="font-sans text-slate-500">{alert.unitLabel}</span>
                      </td>
                      <td
                        className={`py-3 px-4 text-left font-mono tabular-nums font-semibold whitespace-nowrap ${
                          alert.deficit > 0 ? 'text-rose-700' : 'text-slate-400'
                        }`}
                        dir="ltr"
                      >
                        {alert.deficit > 0 ? `-${formatQty(alert.deficit)}` : '0'}
                      </td>
                      <td className="py-3 px-4 text-left whitespace-nowrap">
                        <div className="font-mono tabular-nums font-semibold text-emerald-700">
                          {formatQty(alert.suggestedOrderQty)} {alert.unitLabel}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-slate-400" dir="ltr">
                          {formatCurrency(alert.estimatedReplenishCost)}
                        </div>
                      </td>
                      <td className={`py-3 px-4 font-semibold whitespace-nowrap ${statusTone}`}>
                        {statusLabel}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate('purchases')}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline whitespace-nowrap"
                        >
                          إنشاء مشتريات
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cash Flow Forecasting Section (Due Dates of Credit Sales & Credit Purchases) */}
      <section className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-950">
              توقعات التدفق النقدي القادم (Cash Flow Forecasting)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تقدير التحصيلات والالتزامات النقدية القادمة استناداً إلى تواريخ استحقاق فواتير المبيعات والمشتريات الآجلة المفتوحة
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <span>تاريخ المرجع:</span>
              <input
                type="date"
                value={forecastAsOfDate}
                onChange={(e) => setForecastAsOfDate(e.target.value || '2026-11-13')}
                className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300/90 rounded-xl text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                dir="ltr"
              />
            </label>

            <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
              {([30, 60, 90] as ForecastHorizon[]).map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setForecastHorizon(days)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    forecastHorizon === days
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {days} يوم
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4-Column Forecast KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200/80 border-b border-slate-200/80">
          <div className="p-4 sm:px-6">
            <div className="text-xs text-slate-500">تحصيلات مبيعات آجلة متوقعة</div>
            <div
              className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700"
              dir="ltr"
            >
              +{formatCurrency(cashFlowForecast.expectedInflows)}
            </div>
          </div>
          <div className="p-4 sm:px-6">
            <div className="text-xs text-slate-500">مدفوعات مشتريات آجلة مستحقة</div>
            <div
              className="mt-1 text-lg font-bold font-mono tabular-nums text-rose-700"
              dir="ltr"
            >
              -{formatCurrency(cashFlowForecast.expectedOutflows)}
            </div>
          </div>
          <div className="p-4 sm:px-6">
            <div className="text-xs text-slate-500">صافي التدفق النقدي للفترة</div>
            <div
              className={`mt-1 text-lg font-bold font-mono tabular-nums ${
                cashFlowForecast.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
              dir="ltr"
            >
              {cashFlowForecast.netCashFlow >= 0 ? '+' : ''}
              {formatCurrency(cashFlowForecast.netCashFlow)}
            </div>
          </div>
          <div className="p-4 sm:px-6">
            <div className="text-xs text-slate-500">السيولة النقدية المتوقعة بنهاية الأفق</div>
            <div
              className="mt-1 text-lg font-bold font-mono tabular-nums text-amber-700"
              dir="ltr"
            >
              {formatCurrency(cashFlowForecast.projectedEndingCash)}
            </div>
          </div>
        </div>

        {/* Bucketed Timeline + Scheduled Credit Invoices */}
        <div className="grid grid-cols-1 xl:grid-cols-12 divide-y xl:divide-y-0 xl:divide-x xl:divide-x-reverse divide-slate-200/80">
          {/* Left: Time-Bucket Cash Flow Bars (5 cols) */}
          <div className="xl:col-span-5 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-900">
                توزيع التدفقات حسب فترات الاستحقاق
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>تدفق داخل</span>
                <span aria-hidden="true">/</span>
                <span>تدفق خارج</span>
              </div>
            </div>

            <div className="space-y-4">
              {cashFlowForecast.buckets.map((bucket) => {
                const inPct = Math.round(
                  (bucket.inflows / cashFlowForecast.maxBucketValue) * 100
                );
                const outPct = Math.round(
                  (bucket.outflows / cashFlowForecast.maxBucketValue) * 100
                );
                return (
                  <div key={bucket.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{bucket.label}</span>
                      <span className="text-[11px] text-slate-500">
                        الرصيد المتوقع:{' '}
                        <span
                          className="font-mono tabular-nums font-semibold text-slate-900"
                          dir="ltr"
                        >
                          {formatCurrency(bucket.projectedCashAfter)}
                        </span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[11px] text-emerald-700 shrink-0">وارد</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                            style={{ width: `${inPct}%` }}
                          />
                        </div>
                        <span
                          className="w-24 text-left text-[11px] font-mono tabular-nums text-emerald-700 shrink-0"
                          dir="ltr"
                        >
                          {formatCurrency(bucket.inflows)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="w-12 text-[11px] text-rose-700 shrink-0">صادر</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-rose-500 rounded-full transition-all duration-300"
                            style={{ width: `${outPct}%` }}
                          />
                        </div>
                        <span
                          className="w-24 text-left text-[11px] font-mono tabular-nums text-rose-700 shrink-0"
                          dir="ltr"
                        >
                          {formatCurrency(bucket.outflows)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Due Invoices Schedule Table (7 cols) */}
          <div className="xl:col-span-7 flex flex-col justify-between">
            <div>
              <div className="px-6 py-3.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-900">
                  جدول استحقاق الفواتير الآجلة ({cashFlowForecast.totalScheduledCount})
                </span>
                <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
                  {(
                    [
                      { key: 'all', label: 'الكل' },
                      { key: 'inflow', label: 'تحصيل مبيعات' },
                      { key: 'outflow', label: 'سداد مشتريات' },
                    ] as { key: ForecastFlowFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setForecastFlowFilter(tab.key)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                        forecastFlowFilter === tab.key
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4">الاستحقاق</th>
                      <th className="py-3 px-4">الفاتورة</th>
                      <th className="py-3 px-4">الطرف وشروط السداد</th>
                      <th className="py-3 px-4">الحالة الزمنية</th>
                      <th className="py-3 px-4 text-left">التدفق المتوقع</th>
                      <th className="py-3 px-4 text-center">القيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {cashFlowForecast.filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          لا توجد فواتير آجلة مفتوحة تستحق ضمن نطاق {forecastHorizon} يوماً.
                        </td>
                      </tr>
                    ) : (
                      cashFlowForecast.filteredEvents.map((ev) => {
                        const timingLabel =
                          ev.daysUntilDue < 0
                            ? `متأخرة ${Math.abs(ev.daysUntilDue)} يوم`
                            : ev.daysUntilDue === 0
                              ? 'تستحق اليوم'
                              : `بعد ${ev.daysUntilDue} يوم`;
                        return (
                          <tr key={ev.id} className="hover:bg-slate-50/90 transition-colors">
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <div className="font-mono tabular-nums font-semibold text-slate-950">
                                {ev.dueDate}
                              </div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                إصدار {ev.invoiceDate}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onNavigate(ev.targetTab)}
                                className="font-mono tabular-nums font-semibold text-emerald-700 hover:underline"
                              >
                                {ev.docNo}
                              </button>
                              <div className="text-[11px] text-slate-500">
                                {ev.flowKind === 'inflow' ? 'تحصيل مبيعات' : 'سداد مشتريات'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="text-slate-900 font-medium truncate max-w-[170px]">
                                {ev.partyName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                                صافي {ev.termsDays} يوم
                              </div>
                            </td>
                            <td
                              className={`py-2.5 px-4 whitespace-nowrap font-medium ${
                                ev.daysUntilDue <= 0
                                  ? 'text-rose-700'
                                  : ev.daysUntilDue <= 15
                                    ? 'text-amber-700'
                                    : 'text-slate-600'
                              }`}
                            >
                              {timingLabel}
                            </td>
                            <td
                              className={`py-2.5 px-4 font-mono tabular-nums font-bold text-left whitespace-nowrap ${
                                ev.flowKind === 'inflow' ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                              dir="ltr"
                            >
                              {ev.flowKind === 'inflow' ? '+' : '-'}
                              {formatCurrency(ev.amount)}
                            </td>
                            <td className="py-2.5 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => onViewJournalEntry(ev.journalEntryId)}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700"
                                title="عرض القيد المحاسبي"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>عرض</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-slate-200/80 bg-slate-50/30 px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  ذمم افتتاحية سابقة غير مفوترة — عملاء:{' '}
                  <span className="font-mono tabular-nums text-slate-800 font-medium" dir="ltr">
                    {formatCurrency(cashFlowForecast.unscheduledReceivables)}
                  </span>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  موردون:{' '}
                  <span className="font-mono tabular-nums text-slate-800 font-medium" dir="ltr">
                    {formatCurrency(cashFlowForecast.unscheduledPayables)}
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('party_reports')}
                className="text-emerald-700 hover:text-emerald-800 hover:underline font-semibold whitespace-nowrap"
              >
                تحليل أعمار الديون التفصيلي
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Row: Recent Operations Table & Financial Position Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Recent Financial & Trade Activity (8 cols) */}
        <section className="lg:col-span-8 bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-950">أحدث الفواتير والسندات المرحّلة</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                آخر 8 حركات بيع وشراء وقبض وصرف مرتبطة مباشرة بدفتر اليومية
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('journal_entries')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
            >
              دفتر اليومية ({journalEntries.length})
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">المرجع</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">الطرف</th>
                  <th className="py-3 px-4">السداد</th>
                  <th className="py-3 px-4 text-left">القيمة</th>
                  <th className="py-3 px-4 text-center">القيد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد حركات مسجلة بعد. ابدأ بتسجيل فاتورة مبيعات أو مشتريات.
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/90 transition-colors">
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {row.date}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigate(row.targetTab)}
                          className="font-mono tabular-nums font-semibold text-emerald-700 hover:underline"
                        >
                          {row.refNo}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-slate-900 font-medium whitespace-nowrap">
                        {row.kindLabel}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 truncate max-w-[160px]">
                        {row.partyName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                        {row.paymentLabel}
                      </td>
                      <td
                        className={`py-2.5 px-4 font-mono tabular-nums font-semibold text-left whitespace-nowrap ${
                          row.directionTone === 'in' ? 'text-emerald-700' : 'text-slate-950'
                        }`}
                        dir="ltr"
                      >
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onViewJournalEntry(row.journalEntryId)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-emerald-700"
                          title="عرض القيد المحاسبي"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Financial Position & Parties Snapshot (4 cols) */}
        <section className="lg:col-span-4 bg-white border border-slate-200/90 shadow-2xs rounded-2xl flex flex-col justify-between overflow-hidden">
          <div>
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-950">ملخص المركز المالي والذمم</h3>
              <button
                type="button"
                onClick={() => onNavigate('party_reports')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0"
              >
                أعمار الديون
              </button>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-slate-600">إجمالي الأصول</span>
                <span className="font-mono tabular-nums font-bold text-slate-950" dir="ltr">
                  {formatCurrency(financialMetrics.totalAssets)}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-slate-600">إجمالي الالتزامات</span>
                <span className="font-mono tabular-nums font-bold text-slate-950" dir="ltr">
                  {formatCurrency(financialMetrics.totalLiabilities)}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-slate-600">حقوق الملكية وصافي الربح</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700" dir="ltr">
                  {formatCurrency(financialMetrics.totalEquityWithProfit)}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-slate-600">ذمم العملاء المدينة (AR)</span>
                <span className="font-mono tabular-nums font-semibold text-emerald-700" dir="ltr">
                  {formatCurrency(financialMetrics.totalReceivables)}
                </span>
              </div>
              <div className="px-6 py-3.5 flex items-center justify-between">
                <span className="text-slate-600">ذمم الموردين الدائنة (AP)</span>
                <span className="font-mono tabular-nums font-semibold text-amber-700" dir="ltr">
                  {formatCurrency(financialMetrics.totalPayables)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/80 bg-slate-50/30 px-6 py-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onNavigate('partner_reports')}
              className="text-xs font-semibold text-slate-700 hover:text-emerald-700 whitespace-nowrap"
            >
              تقرير جاري الشركاء والأرباح
            </button>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
            >
              + فاتورة مبيعات
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
