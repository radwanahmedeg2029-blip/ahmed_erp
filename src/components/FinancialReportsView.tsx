import { useMemo, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import { ChartAccount, JournalEntry } from '../types/erp';

interface FinancialReportsViewProps {
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  onViewJournalEntry: (entryId: string) => void;
}

type FinancialSubTab = 'trial_balance' | 'income_statement' | 'balance_sheet' | 'general_ledger';

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

export function FinancialReportsView({
  accounts,
  journalEntries,
  onViewJournalEntry,
}: FinancialReportsViewProps) {
  const [subTab, setSubTab] = useState<FinancialSubTab>('trial_balance');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-12-31');
  const [showZeroAccounts, setShowZeroAccounts] = useState(false);

  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable).sort((a, b) => a.code.localeCompare(b.code)),
    [accounts]
  );

  const [selectedGlAccountId, setSelectedGlAccountId] = useState<string>(
    () =>
      accounts.find((a) => a.code === '110101')?.id ??
      accounts.find((a) => a.isPostable)?.id ??
      ''
  );

  // 1) Trial Balance Calculation (within dateFrom..dateTo)
  const trialBalance = useMemo(() => {
    const rows = postableAccounts
      .map((acc) => {
        let debitSum = 0;
        let creditSum = 0;
        for (const je of journalEntries) {
          if (je.status !== 'posted') continue;
          if (je.entryDate < dateFrom || je.entryDate > dateTo) continue;
          for (const line of je.lines) {
            if (line.accountId === acc.id) {
              debitSum += line.debit;
              creditSum += line.credit;
            }
          }
        }
        const net = debitSum - creditSum;
        const endingDebit = net > 0 ? net : 0;
        const endingCredit = net < 0 ? Math.abs(net) : 0;
        return {
          account: acc,
          debitSum,
          creditSum,
          endingDebit,
          endingCredit,
        };
      })
      .filter((r) => showZeroAccounts || r.debitSum > 0 || r.creditSum > 0);

    const totals = rows.reduce(
      (acc, r) => ({
        debitSum: acc.debitSum + r.debitSum,
        creditSum: acc.creditSum + r.creditSum,
        endingDebit: acc.endingDebit + r.endingDebit,
        endingCredit: acc.endingCredit + r.endingCredit,
      }),
      { debitSum: 0, creditSum: 0, endingDebit: 0, endingCredit: 0 }
    );

    const isBalanced =
      Math.abs(totals.debitSum - totals.creditSum) < 0.01 &&
      Math.abs(totals.endingDebit - totals.endingCredit) < 0.01;

    return { rows, totals, isBalanced };
  }, [postableAccounts, journalEntries, dateFrom, dateTo, showZeroAccounts]);

  // 2) Income Statement Calculation (within dateFrom..dateTo)
  const incomeStatement = useMemo(() => {
    const calcNet = (acc: ChartAccount) => {
      let val = 0;
      for (const je of journalEntries) {
        if (je.status !== 'posted') continue;
        if (je.entryDate < dateFrom || je.entryDate > dateTo) continue;
        for (const line of je.lines) {
          if (line.accountId === acc.id) {
            val +=
              acc.accountType === 'revenue'
                ? line.credit - line.debit
                : line.debit - line.credit;
          }
        }
      }
      return Number(val.toFixed(2));
    };

    const revenues = postableAccounts
      .filter((a) => a.accountType === 'revenue')
      .map((a) => ({ account: a, amount: calcNet(a) }))
      .filter((r) => r.amount !== 0);

    const cogs = postableAccounts
      .filter((a) => a.accountType === 'expense' && a.code.startsWith('51'))
      .map((a) => ({ account: a, amount: calcNet(a) }))
      .filter((r) => r.amount !== 0);

    const operatingExpenses = postableAccounts
      .filter((a) => a.accountType === 'expense' && !a.code.startsWith('51'))
      .map((a) => ({ account: a, amount: calcNet(a) }))
      .filter((r) => r.amount !== 0);

    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);
    const totalCogs = cogs.reduce((s, r) => s + r.amount, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalOpEx = operatingExpenses.reduce((s, r) => s + r.amount, 0);
    const netIncome = grossProfit - totalOpEx;

    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    return {
      revenues,
      cogs,
      operatingExpenses,
      totalRevenue,
      totalCogs,
      grossProfit,
      totalOpEx,
      netIncome,
      grossMargin,
      netMargin,
    };
  }, [postableAccounts, journalEntries, dateFrom, dateTo]);

  // 3) Balance Sheet Calculation (As of dateTo)
  const balanceSheet = useMemo(() => {
    const calcAsOf = (acc: ChartAccount) => {
      let val = 0;
      for (const je of journalEntries) {
        if (je.status !== 'posted') continue;
        if (je.entryDate > dateTo) continue;
        for (const line of je.lines) {
          if (line.accountId === acc.id) {
            val +=
              acc.normalBalance === 'debit'
                ? line.debit - line.credit
                : line.credit - line.debit;
          }
        }
      }
      return Number(val.toFixed(2));
    };

    const assets = postableAccounts
      .filter((a) => a.accountType === 'asset')
      .map((a) => ({ account: a, balance: calcAsOf(a) }))
      .filter((r) => r.balance !== 0);

    const liabilities = postableAccounts
      .filter((a) => a.accountType === 'liability')
      .map((a) => ({ account: a, balance: calcAsOf(a) }))
      .filter((r) => r.balance !== 0);

    const equity = postableAccounts
      .filter((a) => a.accountType === 'equity')
      .map((a) => ({ account: a, balance: calcAsOf(a) }))
      .filter((r) => r.balance !== 0);

    // Current Period Profit as of dateTo
    let profitAsOf = 0;
    for (const je of journalEntries) {
      if (je.status !== 'posted' || je.entryDate > dateTo) continue;
      for (const line of je.lines) {
        const acc = postableAccounts.find((a) => a.id === line.accountId);
        if (!acc) continue;
        if (acc.accountType === 'revenue') profitAsOf += line.credit - line.debit;
        else if (acc.accountType === 'expense') profitAsOf -= line.debit - line.credit;
      }
    }
    profitAsOf = Number(profitAsOf.toFixed(2));

    const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
    const totalEquityBase = equity.reduce((s, r) => s + r.balance, 0);
    const totalEquityWithProfit = totalEquityBase + profitAsOf;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquityWithProfit;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05;

    return {
      assets,
      liabilities,
      equity,
      profitAsOf,
      totalAssets,
      totalLiabilities,
      totalEquityWithProfit,
      totalLiabilitiesAndEquity,
      isBalanced,
    };
  }, [postableAccounts, journalEntries, dateTo]);

  // 4) General Ledger for Selected Account
  const generalLedger = useMemo(() => {
    const account = postableAccounts.find((a) => a.id === selectedGlAccountId);
    if (!account) return { account: null, openingBalance: 0, rows: [], closingBalance: 0, totalDebit: 0, totalCredit: 0 };

    let openingBalance = 0;
    const matchingLines: {
      jeId: string;
      entryDate: string;
      entryNo: string;
      sourceRefNo: string;
      memo: string;
      debit: number;
      credit: number;
    }[] = [];

    const sortedEntries = [...journalEntries]
      .filter((je) => je.status === 'posted')
      .sort((a, b) =>
        a.entryDate === b.entryDate
          ? a.entryNo.localeCompare(b.entryNo)
          : a.entryDate.localeCompare(b.entryDate)
      );

    for (const je of sortedEntries) {
      for (const line of je.lines) {
        if (line.accountId !== account.id) continue;
        const delta =
          account.normalBalance === 'debit'
            ? line.debit - line.credit
            : line.credit - line.debit;

        if (je.entryDate < dateFrom) {
          openingBalance += delta;
        } else if (je.entryDate <= dateTo) {
          matchingLines.push({
            jeId: je.id,
            entryDate: je.entryDate,
            entryNo: je.entryNo,
            sourceRefNo: je.sourceRefNo,
            memo: line.lineMemo || je.description,
            debit: line.debit,
            credit: line.credit,
          });
        }
      }
    }

    let running = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;
    const rows = matchingLines.map((m) => {
      const delta =
        account.normalBalance === 'debit' ? m.debit - m.credit : m.credit - m.debit;
      running += delta;
      totalDebit += m.debit;
      totalCredit += m.credit;
      return { ...m, runningBalance: Number(running.toFixed(2)) };
    });

    return {
      account,
      openingBalance: Number(openingBalance.toFixed(2)),
      rows,
      closingBalance: Number(running.toFixed(2)),
      totalDebit: Number(totalDebit.toFixed(2)),
      totalCredit: Number(totalCredit.toFixed(2)),
    };
  }, [postableAccounts, selectedGlAccountId, journalEntries, dateFrom, dateTo]);

  const handleExportCurrentReport = () => {
    if (subTab === 'trial_balance') {
      downloadCsv(
        `trial_balance_${dateFrom}_${dateTo}.csv`,
        ['رمز الحساب', 'اسم الحساب', 'الطبيعة', 'مدين الفترة', 'دائن الفترة', 'رصيد مدين', 'رصيد دائن'],
        trialBalance.rows.map((r) => [
          r.account.code,
          r.account.nameAr,
          r.account.normalBalance === 'debit' ? 'مدين' : 'دائن',
          r.debitSum.toFixed(2),
          r.creditSum.toFixed(2),
          r.endingDebit.toFixed(2),
          r.endingCredit.toFixed(2),
        ])
      );
    } else if (subTab === 'income_statement') {
      downloadCsv(
        `income_statement_${dateFrom}_${dateTo}.csv`,
        ['البند', 'رمز الحساب', 'القيمة'],
        [
          ...incomeStatement.revenues.map((r) => [r.account.nameAr, r.account.code, r.amount.toFixed(2)]),
          ['إجمالي الإيرادات', '', incomeStatement.totalRevenue.toFixed(2)],
          ...incomeStatement.cogs.map((r) => [r.account.nameAr, r.account.code, (-r.amount).toFixed(2)]),
          ['مجمل الربح', '', incomeStatement.grossProfit.toFixed(2)],
          ...incomeStatement.operatingExpenses.map((r) => [r.account.nameAr, r.account.code, (-r.amount).toFixed(2)]),
          ['صافي الربح / الخسارة', '', incomeStatement.netIncome.toFixed(2)],
        ]
      );
    } else if (subTab === 'balance_sheet') {
      downloadCsv(
        `balance_sheet_${dateTo}.csv`,
        ['القسم', 'رمز الحساب', 'اسم الحساب', 'الرصيد'],
        [
          ...balanceSheet.assets.map((r) => ['الأصول', r.account.code, r.account.nameAr, r.balance.toFixed(2)]),
          ['إجمالي الأصول', '', '', balanceSheet.totalAssets.toFixed(2)],
          ...balanceSheet.liabilities.map((r) => ['الالتزامات', r.account.code, r.account.nameAr, r.balance.toFixed(2)]),
          ...balanceSheet.equity.map((r) => ['حقوق الملكية', r.account.code, r.account.nameAr, r.balance.toFixed(2)]),
          ['حقوق الملكية', '3999', 'صافي ربح/خسارة الفترة', balanceSheet.profitAsOf.toFixed(2)],
          ['إجمالي الالتزامات وحقوق الملكية', '', '', balanceSheet.totalLiabilitiesAndEquity.toFixed(2)],
        ]
      );
    } else if (subTab === 'general_ledger' && generalLedger.account) {
      downloadCsv(
        `general_ledger_${generalLedger.account.code}.csv`,
        ['التاريخ', 'رقم القيد', 'المرجع', 'البيان', 'مدين', 'دائن', 'الرصيد المتحرك'],
        [
          [dateFrom, 'OPENING', '—', 'رصيد أول المدة', '0.00', '0.00', generalLedger.openingBalance.toFixed(2)],
          ...generalLedger.rows.map((r) => [
            r.entryDate,
            r.entryNo,
            r.sourceRefNo,
            r.memo,
            r.debit.toFixed(2),
            r.credit.toFixed(2),
            r.runningBalance.toFixed(2),
          ]),
        ]
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation + Date Controls */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'trial_balance', label: 'ميزان المراجعة' },
                { id: 'income_statement', label: 'قائمة الدخل (الأرباح والخسائر)' },
                { id: 'balance_sheet', label: 'قائمة المركز المالي (الميزانية)' },
                { id: 'general_ledger', label: 'دفتر الأستاذ العام' },
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
            {subTab !== 'balance_sheet' && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500">من:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  dir="ltr"
                  className="px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg"
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">
                {subTab === 'balance_sheet' ? 'كما في تاريخ:' : 'إلى:'}
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                dir="ltr"
                className="px-2.5 py-1.5 font-mono text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="button"
              onClick={handleExportCurrentReport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Trial Balance */}
      {subTab === 'trial_balance' && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                ميزان المراجعة بالمجاميع والأرصدة (vw_trial_balance)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                حالة التوازن المحاسبي:{' '}
                <strong
                  className={
                    trialBalance.isBalanced ? 'text-emerald-700' : 'text-red-700'
                  }
                >
                  {trialBalance.isBalanced
                    ? 'متوازن 100% (إجمالي المدين = إجمالي الدائن)'
                    : 'يوجد فرق محاسبي'}
                </strong>
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showZeroAccounts}
                onChange={(e) => setShowZeroAccounts(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>إظهار الحسابات ذات الرصيد الصفري</span>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-28">رمز الحساب</th>
                  <th className="py-3 px-4">اسم الحساب</th>
                  <th className="py-3 px-4">الطبيعة</th>
                  <th className="py-3 px-4 text-left">مجاميع مدين</th>
                  <th className="py-3 px-4 text-left">مجاميع دائن</th>
                  <th className="py-3 px-4 text-left">رصيد مدين</th>
                  <th className="py-3 px-4 text-left">رصيد دائن</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {trialBalance.rows.map((row) => (
                  <tr key={row.account.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono font-semibold text-emerald-700 tabular-nums">
                      {row.account.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGlAccountId(row.account.id);
                          setSubTab('general_ledger');
                        }}
                        className="hover:text-emerald-700 hover:underline text-right"
                      >
                        {row.account.nameAr}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">
                      {row.account.normalBalance === 'debit' ? 'مدين' : 'دائن'}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-700" dir="ltr">
                      {row.debitSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono tabular-nums text-slate-700" dir="ltr">
                      {row.creditSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-semibold tabular-nums text-slate-900" dir="ltr">
                      {row.endingDebit > 0
                        ? row.endingDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-left font-mono font-semibold tabular-nums text-slate-900" dir="ltr">
                      {row.endingCredit > 0
                        ? row.endingCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white text-xs font-bold">
                  <td colSpan={3} className="py-3 px-4">
                    الإجمالي العام لميزان المراجعة
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {trialBalance.totals.debitSum.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {trialBalance.totals.creditSum.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums text-emerald-300" dir="ltr">
                    {trialBalance.totals.endingDebit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums text-emerald-300" dir="ltr">
                    {trialBalance.totals.endingCredit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. Income Statement (P&L) */}
      {subTab === 'income_statement' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200">
            <div className="p-4">
              <div className="text-xs text-slate-500">إجمالي الإيرادات</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900" dir="ltr">
                {incomeStatement.totalRevenue.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">
                مجمل الربح ({incomeStatement.grossMargin.toFixed(1)}%)
              </div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
                {incomeStatement.grossProfit.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">المصروفات التشغيلية والإدارية</div>
              <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900" dir="ltr">
                {incomeStatement.totalOpEx.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs text-slate-500">
                صافي ربح / خسارة الفترة ({incomeStatement.netMargin.toFixed(1)}%)
              </div>
              <div
                className={`mt-1 text-xl font-bold font-mono tabular-nums ${
                  incomeStatement.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
                dir="ltr"
              >
                {incomeStatement.netIncome.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                قائمة الدخل التفصيلية للفترة ({dateFrom} إلى {dateTo})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-5 w-28">رمز الحساب</th>
                    <th className="py-3 px-5">البند / الحساب</th>
                    <th className="py-3 px-5 text-left w-44">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/70 font-semibold text-slate-800">
                    <td colSpan={3} className="py-2.5 px-5">
                      أولاً: الإيرادات التشغيلية والمبيعات
                    </td>
                  </tr>
                  {incomeStatement.revenues.map((r) => (
                    <tr key={r.account.id}>
                      <td className="py-2.5 px-5 font-mono text-emerald-700">{r.account.code}</td>
                      <td className="py-2.5 px-5 text-slate-900">{r.account.nameAr}</td>
                      <td className="py-2.5 px-5 text-left font-mono font-semibold tabular-nums" dir="ltr">
                        {r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/70 font-bold text-slate-900">
                    <td colSpan={2} className="py-2.5 px-5">
                      إجمالي الإيرادات
                    </td>
                    <td className="py-2.5 px-5 text-left font-mono tabular-nums" dir="ltr">
                      {incomeStatement.totalRevenue.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/70 font-semibold text-slate-800">
                    <td colSpan={3} className="py-2.5 px-5">
                      ثانياً: يُخصم تكلفة البضاعة المباعة (COGS)
                    </td>
                  </tr>
                  {incomeStatement.cogs.map((r) => (
                    <tr key={r.account.id}>
                      <td className="py-2.5 px-5 font-mono text-emerald-700">{r.account.code}</td>
                      <td className="py-2.5 px-5 text-slate-900">{r.account.nameAr}</td>
                      <td className="py-2.5 px-5 text-left font-mono text-red-700 tabular-nums" dir="ltr">
                        ({r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/60 font-bold text-emerald-900">
                    <td colSpan={2} className="py-3 px-5">
                      مجمل الربح (Gross Profit)
                    </td>
                    <td className="py-3 px-5 text-left font-mono tabular-nums" dir="ltr">
                      {incomeStatement.grossProfit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/70 font-semibold text-slate-800">
                    <td colSpan={3} className="py-2.5 px-5">
                      ثالثاً: يُخصم مصروفات التشغيل والإدارة وخسائر المخزون
                    </td>
                  </tr>
                  {incomeStatement.operatingExpenses.map((r) => (
                    <tr key={r.account.id}>
                      <td className="py-2.5 px-5 font-mono text-emerald-700">{r.account.code}</td>
                      <td className="py-2.5 px-5 text-slate-900">{r.account.nameAr}</td>
                      <td className="py-2.5 px-5 text-left font-mono text-red-700 tabular-nums" dir="ltr">
                        ({r.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td colSpan={2} className="py-3.5 px-5">
                      صافي الربح / (الخسارة) القابل للتوزيع — Net Income
                    </td>
                    <td
                      className={`py-3.5 px-5 text-left font-mono tabular-nums ${
                        incomeStatement.netIncome >= 0 ? 'text-emerald-300' : 'text-red-300'
                      }`}
                      dir="ltr"
                    >
                      {incomeStatement.netIncome.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Balance Sheet */}
      {subTab === 'balance_sheet' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500">معادلة المركز المالي كما في {dateTo}:</span>{' '}
              <strong className="font-mono text-slate-900" dir="ltr">
                Assets ({balanceSheet.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2 })}) = Liabilities + Equity ({balanceSheet.totalLiabilitiesAndEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })})
              </strong>
            </div>
            <span
              className={`font-semibold ${
                balanceSheet.isBalanced ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {balanceSheet.isBalanced ? 'الميزانية العمومية متزنة 100%' : 'يوجد فرق في الميزانية'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            {/* Right: Assets */}
            <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">
                  جانب الأصول (Assets)
                </h3>
              </div>
              <table className="w-full text-right border-collapse text-xs">
                <tbody className="divide-y divide-slate-100">
                  {balanceSheet.assets.map((row) => (
                    <tr key={row.account.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-emerald-700 w-24">
                        {row.account.code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {row.account.nameAr}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                        dir="ltr"
                      >
                        {row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td colSpan={2} className="py-3 px-4">
                      إجمالي الأصول
                    </td>
                    <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                      {balanceSheet.totalAssets.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Left: Liabilities & Equity */}
            <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">
                  جانب الالتزامات وحقوق الملكية (Liabilities & Equity)
                </h3>
              </div>
              <table className="w-full text-right border-collapse text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50/80 font-semibold text-slate-700">
                    <td colSpan={3} className="py-2 px-4">
                      الالتزامات المتداولة
                    </td>
                  </tr>
                  {balanceSheet.liabilities.map((row) => (
                    <tr key={row.account.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-emerald-700 w-24">
                        {row.account.code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {row.account.nameAr}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                        dir="ltr"
                      >
                        {row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100/70 font-semibold text-slate-900">
                    <td colSpan={2} className="py-2 px-4">
                      مجموع الالتزامات
                    </td>
                    <td className="py-2 px-4 text-left font-mono tabular-nums" dir="ltr">
                      {balanceSheet.totalLiabilities.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>

                  <tr className="bg-slate-50/80 font-semibold text-slate-700">
                    <td colSpan={3} className="py-2 px-4">
                      حقوق الملكية وصافي ربح الفترة
                    </td>
                  </tr>
                  {balanceSheet.equity.map((row) => (
                    <tr key={row.account.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-mono text-emerald-700 w-24">
                        {row.account.code}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {row.account.nameAr}
                      </td>
                      <td
                        className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                        dir="ltr"
                      >
                        {row.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50/50">
                    <td className="py-2.5 px-4 font-mono text-emerald-700">3999</td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-900">
                      صافي ربح / خسارة الفترة الحالية (مرحّل من قائمة الدخل)
                    </td>
                    <td
                      className={`py-2.5 px-4 text-left font-mono font-bold tabular-nums ${
                        balanceSheet.profitAsOf >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {balanceSheet.profitAsOf.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td colSpan={2} className="py-3 px-4">
                      إجمالي الالتزامات وحقوق الملكية
                    </td>
                    <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                      {balanceSheet.totalLiabilitiesAndEquity.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. General Ledger */}
      {subTab === 'general_ledger' && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-semibold text-slate-700">
                حساب الأستاذ:
              </label>
              <select
                value={selectedGlAccountId}
                onChange={(e) => setSelectedGlAccountId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg min-w-64"
              >
                {postableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.code} — {acc.nameAr}
                  </option>
                ))}
              </select>
            </div>
            {generalLedger.account && (
              <div className="text-xs text-slate-600">
                الطبيعة:{' '}
                <strong className="text-slate-900">
                  {generalLedger.account.normalBalance === 'debit' ? 'مدين' : 'دائن'}
                </strong>{' '}
                · الرصيد الختامي:{' '}
                <strong className="font-mono text-emerald-700" dir="ltr">
                  {generalLedger.closingBalance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </strong>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">رقم القيد</th>
                  <th className="py-3 px-4">المستند المرجعي</th>
                  <th className="py-3 px-4">البيان</th>
                  <th className="py-3 px-4 text-left">مدين</th>
                  <th className="py-3 px-4 text-left">دائن</th>
                  <th className="py-3 px-4 text-left">الرصيد المتحرك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/70 font-medium text-slate-700">
                  <td className="py-2.5 px-4 font-mono tabular-nums">{dateFrom}</td>
                  <td className="py-2.5 px-4 font-mono">OPENING</td>
                  <td className="py-2.5 px-4">—</td>
                  <td className="py-2.5 px-4">رصيد أول المدة المرحّل قبل {dateFrom}</td>
                  <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                    —
                  </td>
                  <td className="py-2.5 px-4 text-left font-mono" dir="ltr">
                    —
                  </td>
                  <td className="py-2.5 px-4 text-left font-mono font-semibold" dir="ltr">
                    {generalLedger.openingBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>

                {generalLedger.rows.map((r, i) => (
                  <tr key={`${r.jeId}-${i}`} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono text-slate-500 tabular-nums">
                      {r.entryDate}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onViewJournalEntry(r.jeId)}
                        className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700 hover:underline"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{r.entryNo}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums">
                      {r.sourceRefNo}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">{r.memo}</td>
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
                  </tr>
                ))}

                {generalLedger.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      لا توجد حركات مرحلة على هذا الحساب ضمن الفترة المحددة.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold">
                  <td colSpan={4} className="py-3 px-4">
                    إجمالي حركات الفترة والرصيد الختامي
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {generalLedger.totalDebit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-left font-mono tabular-nums" dir="ltr">
                    {generalLedger.totalCredit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td
                    className="py-3 px-4 text-left font-mono tabular-nums text-emerald-300"
                    dir="ltr"
                  >
                    {generalLedger.closingBalance.toLocaleString('en-US', {
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
