import { useMemo, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import {
  Customer,
  PurchaseInvoice,
  SalesInvoice,
  Supplier,
  Voucher,
} from '../types/erp';

interface PartyReportsViewProps {
  customers: Customer[];
  suppliers: Supplier[];
  salesInvoices: SalesInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  vouchers: Voucher[];
  onViewJournalEntry: (entryId: string) => void;
}

type PartySubTab = 'statement' | 'aging';
type PartyKind = 'customer' | 'supplier';

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

export function PartyReportsView({
  customers,
  suppliers,
  salesInvoices,
  purchaseInvoices,
  vouchers,
  onViewJournalEntry,
}: PartyReportsViewProps) {
  const [subTab, setSubTab] = useState<PartySubTab>('statement');
  const [partyKind, setPartyKind] = useState<PartyKind>('customer');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id ?? ''
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.id ?? ''
  );
  const [asOfDate, setAsOfDate] = useState<string>('2026-11-13');

  // 1) Detailed Customer / Supplier Account Statement
  const statementData = useMemo(() => {
    const isCustomer = partyKind === 'customer';
    const party = isCustomer
      ? customers.find((c) => c.id === selectedCustomerId)
      : suppliers.find((s) => s.id === selectedSupplierId);

    if (!party) {
      return {
        partyName: '',
        partyCode: '',
        openingBalance: 0,
        rows: [],
        closingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
      };
    }

    interface RawTx {
      date: string;
      docNo: string;
      typeLabel: string;
      description: string;
      debit: number;
      credit: number;
      journalEntryId: string;
    }

    const txs: RawTx[] = [];

    if (isCustomer) {
      for (const inv of salesInvoices) {
        if (inv.customerId !== party.id || inv.paymentMode !== 'credit') continue;
        const isSale = inv.invoiceType === 'sale';
        txs.push({
          date: inv.invoiceDate,
          docNo: inv.invoiceNo,
          typeLabel: isSale ? 'فاتورة مبيعات آجلة' : 'مرتجع مبيعات آجل',
          description: inv.notes,
          debit: isSale ? inv.totalAmount : 0,
          credit: isSale ? 0 : inv.totalAmount,
          journalEntryId: inv.journalEntryId,
        });
      }
      for (const v of vouchers) {
        if (v.partyType !== 'customer' || v.partyId !== party.id) continue;
        const isReceipt = v.voucherType === 'receipt';
        txs.push({
          date: v.voucherDate,
          docNo: v.voucherNo,
          typeLabel: isReceipt ? 'سند قبض' : 'سند صرف للعميل',
          description: v.description,
          debit: isReceipt ? 0 : v.amount,
          credit: isReceipt ? v.amount : 0,
          journalEntryId: v.journalEntryId,
        });
      }
    } else {
      for (const inv of purchaseInvoices) {
        if (inv.supplierId !== party.id || inv.paymentMode !== 'credit') continue;
        const isPurchase = inv.invoiceType === 'purchase';
        txs.push({
          date: inv.invoiceDate,
          docNo: inv.invoiceNo,
          typeLabel: isPurchase ? 'فاتورة مشتريات آجلة' : 'مرتجع مشتريات آجل',
          description: inv.notes,
          debit: isPurchase ? 0 : inv.totalAmount,
          credit: isPurchase ? inv.totalAmount : 0,
          journalEntryId: inv.journalEntryId,
        });
      }
      for (const v of vouchers) {
        if (v.partyType !== 'supplier' || v.partyId !== party.id) continue;
        const isPayment = v.voucherType === 'payment';
        txs.push({
          date: v.voucherDate,
          docNo: v.voucherNo,
          typeLabel: isPayment ? 'سند صرف للمورد' : 'سند قبض من المورد',
          description: v.description,
          debit: isPayment ? v.amount : 0,
          credit: isPayment ? 0 : v.amount,
          journalEntryId: v.journalEntryId,
        });
      }
    }

    txs.sort((a, b) =>
      a.date === b.date ? a.docNo.localeCompare(b.docNo) : a.date.localeCompare(b.date)
    );

    const netTrackedDelta = txs.reduce(
      (sum, t) => sum + (isCustomer ? t.debit - t.credit : t.credit - t.debit),
      0
    );
    const openingBalance = Number((party.currentBalance - netTrackedDelta).toFixed(2));

    let running = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = txs.map((t) => {
      running = Number(
        (running + (isCustomer ? t.debit - t.credit : t.credit - t.debit)).toFixed(2)
      );
      totalDebit += t.debit;
      totalCredit += t.credit;
      return { ...t, runningBalance: running };
    });

    return {
      partyName: party.nameAr,
      partyCode: party.code,
      openingBalance,
      rows,
      closingBalance: Number(running.toFixed(2)),
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
    };
  }, [
    partyKind,
    customers,
    suppliers,
    selectedCustomerId,
    selectedSupplierId,
    salesInvoices,
    purchaseInvoices,
    vouchers,
  ]);

  // 2) AR & AP Aging Report (allocates current open balance FIFO-newest across invoices + opening balance)
  const agingData = useMemo(() => {
    const refMs = new Date(asOfDate).getTime();
    const openMs = new Date('2026-01-01').getTime();

    const computeBuckets = (
      balance: number,
      docs: { date: string; amount: number }[]
    ) => {
      let remaining = Math.max(0, balance);
      let b0_30 = 0;
      let b31_60 = 0;
      let b61_90 = 0;
      let b90Plus = 0;

      // Sort newest invoices first so remaining unpaid debt naturally reflects newest invoices + older residual
      const sortedDocs = [...docs].sort((a, b) => b.date.localeCompare(a.date));

      for (const doc of sortedDocs) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, doc.amount);
        remaining = Number((remaining - alloc).toFixed(2));
        const ageDays = Math.max(
          0,
          Math.floor((refMs - new Date(doc.date).getTime()) / (1000 * 60 * 60 * 24))
        );
        if (ageDays <= 30) b0_30 += alloc;
        else if (ageDays <= 60) b31_60 += alloc;
        else if (ageDays <= 90) b61_90 += alloc;
        else b90Plus += alloc;
      }

      if (remaining > 0) {
        const openAge = Math.max(
          0,
          Math.floor((refMs - openMs) / (1000 * 60 * 60 * 24))
        );
        if (openAge <= 30) b0_30 += remaining;
        else if (openAge <= 60) b31_60 += remaining;
        else if (openAge <= 90) b61_90 += remaining;
        else b90Plus += remaining;
      }

      return {
        b0_30: Number(b0_30.toFixed(2)),
        b31_60: Number(b31_60.toFixed(2)),
        b61_90: Number(b61_90.toFixed(2)),
        b90Plus: Number(b90Plus.toFixed(2)),
      };
    };

    const rows =
      partyKind === 'customer'
        ? customers.map((c) => {
            const docs = salesInvoices
              .filter(
                (i) =>
                  i.customerId === c.id &&
                  i.invoiceType === 'sale' &&
                  i.paymentMode === 'credit'
              )
              .map((i) => ({ date: i.invoiceDate, amount: i.totalAmount }));
            const buckets = computeBuckets(c.currentBalance, docs);
            return {
              id: c.id,
              code: c.code,
              name: c.nameAr,
              termsDays: c.paymentTermsDays,
              creditLimit: c.creditLimit,
              balance: c.currentBalance,
              ...buckets,
            };
          })
        : suppliers.map((s) => {
            const docs = purchaseInvoices
              .filter(
                (i) =>
                  i.supplierId === s.id &&
                  i.invoiceType === 'purchase' &&
                  i.paymentMode === 'credit'
              )
              .map((i) => ({ date: i.invoiceDate, amount: i.totalAmount }));
            const buckets = computeBuckets(s.currentBalance, docs);
            return {
              id: s.id,
              code: s.code,
              name: s.nameAr,
              termsDays: s.paymentTermsDays,
              creditLimit: 0,
              balance: s.currentBalance,
              ...buckets,
            };
          });

    const totals = rows.reduce(
      (acc, r) => ({
        balance: acc.balance + r.balance,
        b0_30: acc.b0_30 + r.b0_30,
        b31_60: acc.b31_60 + r.b31_60,
        b61_90: acc.b61_90 + r.b61_90,
        b90Plus: acc.b90Plus + r.b90Plus,
      }),
      { balance: 0, b0_30: 0, b31_60: 0, b61_90: 0, b90Plus: 0 }
    );

    return { rows, totals };
  }, [partyKind, customers, suppliers, salesInvoices, purchaseInvoices, asOfDate]);

  const handleExportCsv = () => {
    if (subTab === 'statement') {
      downloadCsv(
        `statement_${statementData.partyCode}.csv`,
        ['التاريخ', 'نوع المستند', 'رقم المستند', 'البيان', 'مدين', 'دائن', 'الرصيد المتحرك'],
        [
          ['2026-01-01', 'رصيد افتتاحي', 'OPEN-2026', 'رصيد بداية الفترة', '0.00', '0.00', statementData.openingBalance.toFixed(2)],
          ...statementData.rows.map((r) => [
            r.date,
            r.typeLabel,
            r.docNo,
            r.description,
            r.debit.toFixed(2),
            r.credit.toFixed(2),
            r.runningBalance.toFixed(2),
          ]),
        ]
      );
    } else {
      downloadCsv(
        `aging_${partyKind}_${asOfDate}.csv`,
        ['الكود', 'الاسم', 'الرصيد الإجمالي', '0-30 يوم', '31-60 يوم', '61-90 يوم', '+90 يوم'],
        agingData.rows.map((r) => [
          r.code,
          r.name,
          r.balance.toFixed(2),
          r.b0_30.toFixed(2),
          r.b31_60.toFixed(2),
          r.b61_90.toFixed(2),
          r.b90Plus.toFixed(2),
        ])
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setSubTab('statement')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'statement'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              كشف الحساب التفصيلي
            </button>
            <button
              type="button"
              onClick={() => setSubTab('aging')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                subTab === 'aging'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تقرير أعمار الديون (Aging)
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setPartyKind('customer')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                partyKind === 'customer'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              العملاء (الذمم المدينة)
            </button>
            <button
              type="button"
              onClick={() => setPartyKind('supplier')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                partyKind === 'supplier'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الموردين (الذمم الدائنة)
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap self-start lg:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تصدير CSV</span>
        </button>
      </div>

      {/* 1. Party Statement */}
      {subTab === 'statement' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold text-slate-700">
                {partyKind === 'customer' ? 'اختر العميل:' : 'اختر المورد:'}
              </label>
              {partyKind === 'customer' ? (
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg min-w-64"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.nameAr}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg min-w-64"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.nameAr}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span>
                الرصيد الافتتاحي:{' '}
                <strong className="font-mono text-slate-900" dir="ltr">
                  {statementData.openingBalance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </span>
              <span>
                الرصيد الختامي المستحق:{' '}
                <strong className="font-mono text-emerald-700" dir="ltr">
                  {statementData.closingBalance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">نوع المستند</th>
                    <th className="py-3 px-4">رقم المستند</th>
                    <th className="py-3 px-4">البيان</th>
                    <th className="py-3 px-4 text-left">مدين</th>
                    <th className="py-3 px-4 text-left">دائن</th>
                    <th className="py-3 px-4 text-left">الرصيد المتحرك</th>
                    <th className="py-3 px-4">القيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70 font-medium text-slate-700">
                    <td className="py-2.5 px-4 font-mono">2026-01-01</td>
                    <td className="py-2.5 px-4">رصيد افتتاحي</td>
                    <td className="py-2.5 px-4 font-mono">OPEN-2026</td>
                    <td className="py-2.5 px-4">رصيد بداية العام المرحّل</td>
                    <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                      —
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                      —
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-bold text-slate-900" dir="ltr">
                      {statementData.openingBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">—</td>
                  </tr>

                  {statementData.rows.map((r, idx) => (
                    <tr key={`${r.docNo}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-slate-500">{r.date}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {r.typeLabel}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700">
                        {r.docNo}
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">{r.description}</td>
                      <td className="py-2.5 px-4 text-left font-mono tabular-nums" dir="ltr">
                        {r.debit > 0
                          ? r.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-left font-mono tabular-nums" dir="ltr">
                        {r.credit > 0
                          ? r.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                          : '—'}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-bold text-slate-900 tabular-nums"
                        dir="ltr"
                      >
                        {r.runningBalance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => onViewJournalEntry(r.journalEntryId)}
                          className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>عرض القيد</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td colSpan={4} className="py-3 px-4">
                      إجمالي الحركات والرصيد النهائي ({statementData.partyName})
                    </td>
                    <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                      {statementData.totalDebit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                      {statementData.totalCredit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td
                      className="py-3 px-4 text-left font-mono tabular-nums text-emerald-300"
                      dir="ltr"
                    >
                      {statementData.closingBalance.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Aging Report */}
      {subTab === 'aging' && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {partyKind === 'customer'
                  ? 'تقرير أعمار ديون العملاء — الذمم المدينة (AR Aging)'
                  : 'تقرير أعمار ديون الموردين — الذمم الدائنة (AP Aging)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                تصنيف الأرصدة القائمة وفقاً لأقدمية الفواتير الآجلة وشروط السداد
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">تاريخ الاحتساب:</span>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                dir="ltr"
                className="px-2.5 py-1 font-mono text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-3 px-4">الكود</th>
                  <th className="py-3 px-4">الاسم</th>
                  <th className="py-3 px-4">شروط السداد</th>
                  <th className="py-3 px-4 text-left">الرصيد الإجمالي</th>
                  <th className="py-3 px-4 text-left">0 - 30 يوم</th>
                  <th className="py-3 px-4 text-left">31 - 60 يوم</th>
                  <th className="py-3 px-4 text-left">61 - 90 يوم</th>
                  <th className="py-3 px-4 text-left">+90 يوم (متأخر)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agingData.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-emerald-700 font-semibold">
                      {r.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{r.name}</td>
                    <td className="py-3 px-4 text-slate-500">{r.termsDays} يوم</td>
                    <td
                      className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums"
                      dir="ltr"
                    >
                      {r.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-emerald-700 tabular-nums" dir="ltr">
                      {r.b0_30.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-slate-700 tabular-nums" dir="ltr">
                      {r.b31_60.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-amber-700 tabular-nums" dir="ltr">
                      {r.b61_90.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`py-3 px-4 text-left font-mono font-semibold tabular-nums ${
                        r.b90Plus > 0 ? 'text-red-700' : 'text-slate-400'
                      }`}
                      dir="ltr"
                    >
                      {r.b90Plus.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold">
                  <td colSpan={3} className="py-3 px-4">
                    إجمالي شرائح أعمار الديون
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {agingData.totals.balance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {agingData.totals.b0_30.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {agingData.totals.b31_60.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {agingData.totals.b61_90.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums text-red-300" dir="ltr">
                    {agingData.totals.b90Plus.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
