import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus, Trash2, X } from 'lucide-react';
import {
  ChartAccount,
  JournalEntry,
  JournalEntryLine,
  JournalSourceType,
  Warehouse,
} from '../types/erp';

interface JournalEntriesViewProps {
  entries: JournalEntry[];
  accounts: ChartAccount[];
  warehouses: Warehouse[];
  highlightedEntryId: string | null;
  onPostManualEntry: (payload: {
    entryDate: string;
    description: string;
    lines: Omit<JournalEntryLine, 'id'>[];
  }) => void;
}

const SOURCE_LABELS: Record<JournalSourceType, string> = {
  manual: 'قيد يومية يدوي',
  receipt_voucher: 'سند قبض آلي',
  payment_voucher: 'سند صرف آلي',
  operating_expense: 'مصروف تشغيلي/نثري',
  operating_revenue: 'إيراد تشغيلي',
  purchase_invoice: 'فاتورة مشتريات',
  purchase_return: 'مرتجع مشتريات',
  sales_invoice: 'فاتورة مبيعات',
  sales_return: 'مرتجع مبيعات',
  inventory_adjustment: 'تسوية جردية',
};

interface DraftLine {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
  lineMemo: string;
  warehouseId: string;
}

export function JournalEntriesView({
  entries,
  accounts,
  warehouses,
  highlightedEntryId,
  onPostManualEntry,
}: JournalEntriesViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (highlightedEntryId) initial.add(highlightedEntryId);
    else if (entries[0]) initial.add(entries[0].id);
    return initial;
  });
  const [sourceFilter, setSourceFilter] = useState<'all' | JournalSourceType>('all');
  const [showModal, setShowModal] = useState(false);

  const postableAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable),
    [accounts]
  );

  // Manual Entry Composer State
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [formError, setFormError] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => sourceFilter === 'all' || e.sourceType === sourceFilter)
      .sort((a, b) => b.entryNo.localeCompare(a.entryNo));
  }, [entries, sourceFilter]);

  // Global trial balance check across all posted entries
  const trialTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const je of entries) {
      if (je.status !== 'posted') continue;
      for (const line of je.lines) {
        debit += line.debit;
        credit += line.credit;
      }
    }
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 };
  }, [entries]);

  const handleOpenModal = () => {
    setEntryDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setDraftLines([
      {
        key: `dl-1-${Date.now()}`,
        accountId: postableAccounts.find((a) => a.code === '5201')?.id ?? postableAccounts[0]?.id ?? '',
        debit: '2500',
        credit: '0',
        lineMemo: 'طرف مدين',
        warehouseId: warehouses[0]?.id ?? '',
      },
      {
        key: `dl-2-${Date.now()}`,
        accountId: postableAccounts.find((a) => a.code === '110102')?.id ?? postableAccounts[1]?.id ?? '',
        debit: '0',
        credit: '2500',
        lineMemo: 'طرف دائن',
        warehouseId: '',
      },
    ]);
    setFormError('');
    setShowModal(true);
  };

  const draftTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of draftLines) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    }
    const diff = Number((debit - credit).toFixed(4));
    return { debit, credit, diff, isBalanced: debit > 0 && Math.abs(diff) < 0.0001 };
  }, [draftLines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setFormError('يرجى إدخال وصف القيد العام.');
      return;
    }
    if (!draftTotals.isBalanced) {
      setFormError(
        `لا يمكن الترحيل: القيد غير متوازن (المدين ${draftTotals.debit.toFixed(
          2
        )} ≠ الدائن ${draftTotals.credit.toFixed(2)}).`
      );
      return;
    }
    const validLines: Omit<JournalEntryLine, 'id'>[] = [];
    for (const l of draftLines) {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (d === 0 && c === 0) continue;
      if (d > 0 && c > 0) {
        setFormError('لا يجوز إدخال مبلغ مدين ودائن معاً في نفس السطر (قيد chk_je_line_side).');
        return;
      }
      validLines.push({
        accountId: l.accountId,
        debit: d,
        credit: c,
        lineMemo: l.lineMemo.trim() || description.trim(),
        warehouseId: l.warehouseId || null,
      });
    }
    if (validLines.length < 2) {
      setFormError('يجب أن يحتوي القيد على سطرين على الأقل (مدين ودائن).');
      return;
    }
    onPostManualEntry({
      entryDate,
      description: description.trim(),
      lines: validLines,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Trial Balance Integrity Banner */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">توازن دفتر الأستاذ العام (Trial Balance Check)</div>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
            <span>
              إجمالي المدين:{' '}
              <strong className="font-mono tabular-nums text-slate-900" dir="ltr">
                {trialTotals.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </span>
            <span>
              إجمالي الدائن:{' '}
              <strong className="font-mono tabular-nums text-slate-900" dir="ltr">
                {trialTotals.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </strong>
            </span>
            <span
              className={`text-xs font-semibold ${
                trialTotals.balanced ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {trialTotals.balanced ? 'الدفاتر متوازنة 100%' : 'يوجد فرق محاسبي'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء قيد يومية عام</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-3 flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'all', label: 'جميع القيود' },
            { id: 'sales_invoice', label: 'فواتير مبيعات' },
            { id: 'sales_return', label: 'مرتجعات مبيعات' },
            { id: 'purchase_invoice', label: 'فواتير مشتريات' },
            { id: 'purchase_return', label: 'مرتجعات مشتريات' },
            { id: 'inventory_adjustment', label: 'تسويات جردية' },
            { id: 'receipt_voucher', label: 'سندات قبض' },
            { id: 'payment_voucher', label: 'سندات صرف' },
            { id: 'operating_expense', label: 'مصروفات' },
            { id: 'operating_revenue', label: 'إيرادات' },
            { id: 'manual', label: 'قيود يدوية' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSourceFilter(opt.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              sourceFilter === opt.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Journal Entries Accordion List */}
      <div className="space-y-3">
        {filteredEntries.map((je) => {
          const isOpen = expandedIds.has(je.id) || highlightedEntryId === je.id;
          const sumDebit = je.lines.reduce((s, l) => s + l.debit, 0);
          const sumCredit = je.lines.reduce((s, l) => s + l.credit, 0);

          return (
            <div
              key={je.id}
              className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                highlightedEntryId === je.id
                  ? 'border-emerald-600 ring-1 ring-emerald-600/20'
                  : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand(je.id)}
                className="w-full px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-right hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {je.entryNo}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {je.entryDate}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-medium">
                        {SOURCE_LABELS[je.sourceType]} ({je.sourceRefNo})
                      </span>
                    </div>
                    <div className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                      {je.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0" dir="ltr">
                  <span className="text-slate-700">
                    Dr: {sumDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-slate-700">
                    Cr: {sumCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-200 overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 px-4 w-28">رمز الحساب</th>
                        <th className="py-2 px-4">اسم الحساب</th>
                        <th className="py-2 px-4">البيان الفرعي</th>
                        <th className="py-2 px-4 text-left w-32">مدين (Debit)</th>
                        <th className="py-2 px-4 text-left w-32">دائن (Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {je.lines.map((line) => {
                        const acc = accounts.find((a) => a.id === line.accountId);
                        return (
                          <tr key={line.id}>
                            <td className="py-2.5 px-4 font-mono text-emerald-700 font-semibold tabular-nums">
                              {acc?.code ?? '—'}
                            </td>
                            <td className="py-2.5 px-4 font-medium text-slate-900">
                              {acc?.nameAr ?? '—'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">{line.lineMemo}</td>
                            <td
                              className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                              dir="ltr"
                            >
                              {line.debit > 0
                                ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : '—'}
                            </td>
                            <td
                              className="py-2.5 px-4 text-left font-mono font-semibold text-slate-900 tabular-nums"
                              dir="ltr"
                            >
                              {line.credit > 0
                                ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Manual Journal Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                إنشاء قيد يومية عام (قيد مزدوج متوازن)
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
                    تاريخ القيد
                  </label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    وصف / شرح القيد العام
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثال: إثبات مصروف إيجار المستودع الشهري"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Lines Editor */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    أطراف القيد (حسابات فرعية قابلة للترحيل فقط)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftLines((prev) => [
                        ...prev,
                        {
                          key: `dl-${Date.now()}`,
                          accountId: postableAccounts[0]?.id ?? '',
                          debit: '0',
                          credit: '0',
                          lineMemo: '',
                          warehouseId: '',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة سطر</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {draftLines.map((line, idx) => (
                    <div
                      key={line.key}
                      className="p-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                    >
                      <div className="sm:col-span-5">
                        <select
                          value={line.accountId}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, accountId: e.target.value } : l
                              )
                            )
                          }
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                        >
                          {postableAccounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.debit}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      debit: e.target.value,
                                      credit: Number(e.target.value) > 0 ? '0' : l.credit,
                                    }
                                  : l
                              )
                            )
                          }
                          placeholder="مدين"
                          dir="ltr"
                          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.credit}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? {
                                      ...l,
                                      credit: e.target.value,
                                      debit: Number(e.target.value) > 0 ? '0' : l.debit,
                                    }
                                  : l
                              )
                            )
                          }
                          placeholder="دائن"
                          dir="ltr"
                          className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          value={line.lineMemo}
                          onChange={(e) =>
                            setDraftLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, lineMemo: e.target.value } : l
                              )
                            )
                          }
                          placeholder="ملاحظة"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-end">
                        <button
                          type="button"
                          disabled={draftLines.length <= 2}
                          onClick={() =>
                            setDraftLines((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30"
                          aria-label="حذف السطر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4 font-mono tabular-nums" dir="ltr">
                    <span>Total Dr: {draftTotals.debit.toFixed(2)}</span>
                    <span>Total Cr: {draftTotals.credit.toFixed(2)}</span>
                  </div>
                  <span
                    className={`font-semibold ${
                      draftTotals.isBalanced ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {draftTotals.isBalanced
                      ? 'القيد متوازن وجاهز للترحيل'
                      : `الفرق: ${Math.abs(draftTotals.diff).toFixed(2)}`}
                  </span>
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
                  ترحيل القيد وتحديث الشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
