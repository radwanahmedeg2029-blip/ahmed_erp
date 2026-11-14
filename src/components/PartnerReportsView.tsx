import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { ChartAccount, JournalEntry, Partner, PartnerCurrentTx, PartnerTxType } from '../types/erp';

interface PartnerReportsViewProps {
  partners: Partner[];
  transactions: PartnerCurrentTx[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
}

const TX_TYPE_LABELS: Record<PartnerTxType, string> = {
  capital_injection: 'زيادة رأس مال',
  drawing: 'مسحوبات شخصية',
  profit_share: 'توزيع أرباح',
  loss_share: 'تحصيل خسارة',
  loan_to_company: 'تمويل من الشريك',
};

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

export function PartnerReportsView({
  partners,
  transactions,
  accounts,
  journalEntries,
}: PartnerReportsViewProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [selectedTxType, setSelectedTxType] = useState<'all' | PartnerTxType>('all');

  // Compute live Net Profit from posted Journal Entries (same source as Income Statement)
  const companyNetProfit = useMemo(() => {
    let profit = 0;
    for (const je of journalEntries) {
      if (je.status !== 'posted') continue;
      for (const line of je.lines) {
        const acc = accounts.find((a) => a.id === line.accountId);
        if (!acc) continue;
        if (acc.accountType === 'revenue') profit += line.credit - line.debit;
        else if (acc.accountType === 'expense') profit -= line.debit - line.credit;
      }
    }
    return Number(profit.toFixed(2));
  }, [journalEntries, accounts]);

  const partnerSummaries = useMemo(() => {
    return partners.map((p) => {
      const txs = transactions.filter((t) => t.partnerId === p.id);
      const totalCredits = txs
        .filter((t) => t.direction === 'credit')
        .reduce((s, t) => s + t.amount, 0);
      const totalDrawings = txs
        .filter((t) => t.direction === 'debit')
        .reduce((s, t) => s + t.amount, 0);
      const netCurrent = Number((totalCredits - totalDrawings).toFixed(2));
      const periodProfitShare = Number(
        ((companyNetProfit * p.ownershipPercent) / 100).toFixed(2)
      );
      const totalEquity = Number(
        (p.capitalContribution + netCurrent + periodProfitShare).toFixed(2)
      );

      return {
        partner: p,
        totalCredits,
        totalDrawings,
        netCurrent,
        periodProfitShare,
        totalEquity,
      };
    });
  }, [partners, transactions, companyNetProfit]);

  const totals = useMemo(() => {
    return partnerSummaries.reduce(
      (acc, r) => ({
        capital: acc.capital + r.partner.capitalContribution,
        credits: acc.credits + r.totalCredits,
        drawings: acc.drawings + r.totalDrawings,
        netCurrent: acc.netCurrent + r.netCurrent,
        profitShare: acc.profitShare + r.periodProfitShare,
        totalEquity: acc.totalEquity + r.totalEquity,
      }),
      { capital: 0, credits: 0, drawings: 0, netCurrent: 0, profitShare: 0, totalEquity: 0 }
    );
  }, [partnerSummaries]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(
        (t) =>
          (selectedPartnerId === 'all' || t.partnerId === selectedPartnerId) &&
          (selectedTxType === 'all' || t.transactionType === selectedTxType)
      )
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [transactions, selectedPartnerId, selectedTxType]);

  const handleExportCsv = () => {
    downloadCsv(
      'partners_equity_and_profit_report.csv',
      [
        'الكود',
        'اسم الشريك',
        'نسبة الملكية %',
        'رأس المال المدفوع',
        'إيداعات وأرباح سابقة',
        'مسحوبات شخصية',
        'صافي الجاري',
        'حصة أرباح الفترة',
        'إجمالي حقوق الشريك',
      ],
      partnerSummaries.map((r) => [
        r.partner.code,
        r.partner.nameAr,
        r.partner.ownershipPercent,
        r.partner.capitalContribution.toFixed(2),
        r.totalCredits.toFixed(2),
        r.totalDrawings.toFixed(2),
        r.netCurrent.toFixed(2),
        r.periodProfitShare.toFixed(2),
        r.totalEquity.toFixed(2),
      ])
    );
  };

  return (
    <div className="space-y-4">
      {/* Executive KPI Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200">
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي رأس المال المدفوع</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900" dir="ltr">
            {totals.capital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">صافي ربح الفترة (من قائمة الدخل)</div>
          <div
            className={`mt-1 text-xl font-bold font-mono tabular-nums ${
              companyNetProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}
            dir="ltr"
          >
            {companyNetProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي مسحوبات الشركاء</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700" dir="ltr">
            {totals.drawings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4">
          <div className="text-xs text-slate-500">إجمالي صافي حقوق الشركاء</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
            {totals.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Partners Profit Share & Equity Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              تقرير جاري الشركاء وتوزيع الأرباح (vw_partners_profit_report)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يدمج رأس المال، حركات الجاري (أرباح وإيداعات مقابل مسحوبات)، وحصة كل شريك من صافي ربح الفترة الحالية
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <th className="py-3 px-4">الكود</th>
                <th className="py-3 px-4">اسم الشريك</th>
                <th className="py-3 px-4 text-left">الملكية %</th>
                <th className="py-3 px-4 text-left">رأس المال</th>
                <th className="py-3 px-4 text-left">إيداعات وأرباح سابقة</th>
                <th className="py-3 px-4 text-left">المسحوبات (-)</th>
                <th className="py-3 px-4 text-left">صافي الجاري</th>
                <th className="py-3 px-4 text-left">حصة ربح الفترة</th>
                <th className="py-3 px-4 text-left">إجمالي حقوق الشريك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partnerSummaries.map((r) => (
                <tr key={r.partner.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                    {r.partner.code}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {r.partner.nameAr}
                  </td>
                  <td className="py-3 px-4 text-left font-mono font-semibold tabular-nums" dir="ltr">
                    {r.partner.ownershipPercent}%
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {r.partner.capitalContribution.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono text-emerald-700 tabular-nums" dir="ltr">
                    {r.totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono text-red-700 tabular-nums" dir="ltr">
                    ({r.totalDrawings.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                  </td>
                  <td
                    className={`py-3 px-4 text-left font-mono font-semibold tabular-nums ${
                      r.netCurrent >= 0 ? 'text-slate-900' : 'text-red-700'
                    }`}
                    dir="ltr"
                  >
                    {r.netCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`py-3 px-4 text-left font-mono font-semibold tabular-nums ${
                      r.periodProfitShare >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                    dir="ltr"
                  >
                    {r.periodProfitShare.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className="py-3 px-4 text-left font-mono font-bold text-emerald-700 tabular-nums"
                    dir="ltr"
                  >
                    {r.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-900 text-white font-bold">
                <td colSpan={2} className="py-3 px-4">
                  الإجمالي الكلي للشركاء
                </td>
                <td className="py-3 px-4 text-left font-mono" dir="ltr">
                  100%
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                  {totals.capital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                  {totals.credits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                  ({totals.drawings.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                  {totals.netCurrent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums text-emerald-300" dir="ltr">
                  {totals.profitShare.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td className="py-3 px-4 text-left font-mono tabular-nums text-sky-300" dir="ltr">
                  {totals.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Detailed Partner Current Account Ledger */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            سجل حركات جاري الشركاء التفصيلي
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
            >
              <option value="all">جميع الشركاء</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
            <select
              value={selectedTxType}
              onChange={(e) => setSelectedTxType(e.target.value as 'all' | PartnerTxType)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
            >
              <option value="all">جميع أنواع الحركات</option>
              <option value="drawing">مسحوبات شخصية</option>
              <option value="profit_share">توزيع أرباح</option>
              <option value="loan_to_company">تمويل من الشريك</option>
              <option value="capital_injection">زيادة رأس مال</option>
              <option value="loss_share">تحصيل خسارة</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <th className="py-3 px-4">التاريخ</th>
                <th className="py-3 px-4">الشريك</th>
                <th className="py-3 px-4">نوع الحركة</th>
                <th className="py-3 px-4">المرجع</th>
                <th className="py-3 px-4">البيان</th>
                <th className="py-3 px-4 text-left">له (دائن +)</th>
                <th className="py-3 px-4 text-left">عليه (مدين -)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const p = partners.find((x) => x.id === tx.partnerId);
                return (
                  <tr key={tx.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {tx.transactionDate}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {p?.nameAr ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {TX_TYPE_LABELS[tx.transactionType]}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-emerald-700">
                      {tx.referenceNo}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{tx.notes}</td>
                    <td
                      className="py-2.5 px-4 text-left font-mono font-semibold text-emerald-700 tabular-nums"
                      dir="ltr"
                    >
                      {tx.direction === 'credit'
                        ? tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td
                      className="py-2.5 px-4 text-left font-mono font-semibold text-red-700 tabular-nums"
                      dir="ltr"
                    >
                      {tx.direction === 'debit'
                        ? tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
