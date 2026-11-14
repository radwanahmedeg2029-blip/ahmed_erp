import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  ChartAccount,
  FinancialOpCategory,
  FinancialOperation,
  Warehouse,
} from '../types/erp';

interface ExpensesRevenuesViewProps {
  operations: FinancialOperation[];
  accounts: ChartAccount[];
  warehouses: Warehouse[];
  onRecordOperation: (op: {
    opCategory: FinancialOpCategory;
    opDate: string;
    accountId: string;
    paymentAccountId: string;
    warehouseId: string | null;
    amount: number;
    includeVat: boolean;
    beneficiaryOrPayer: string;
    notes: string;
  }) => void;
  onViewJournalEntry: (entryId: string) => void;
}

const CATEGORY_LABELS: Record<FinancialOpCategory, string> = {
  operating_expense: 'مصروف تشغيلي',
  petty_cash_expense: 'مصروف نثري (عهدة)',
  operating_revenue: 'إيراد تشغيلي',
  other_revenue: 'إيراد متنوع',
};

export function ExpensesRevenuesView({
  operations,
  accounts,
  warehouses,
  onRecordOperation,
  onViewJournalEntry,
}: ExpensesRevenuesViewProps) {
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'expenses' | 'revenues'>('all');
  const [showModal, setShowModal] = useState(false);

  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'expense' && a.isPostable),
    [accounts]
  );
  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'revenue' && a.isPostable),
    [accounts]
  );
  const cashBankAccounts = useMemo(
    () => accounts.filter((a) => a.code.startsWith('1101') && a.isPostable),
    [accounts]
  );

  // Modal state
  const [opCategory, setOpCategory] = useState<FinancialOpCategory>('petty_cash_expense');
  const [opDate, setOpDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(
    expenseAccounts.find((a) => a.code === '5203')?.id ?? expenseAccounts[0]?.id ?? ''
  );
  const [paymentAccountId, setPaymentAccountId] = useState(
    cashBankAccounts.find((a) => a.code === '110103')?.id ?? cashBankAccounts[0]?.id ?? ''
  );
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [amount, setAmount] = useState('450');
  const [includeVat, setIncludeVat] = useState(true);
  const [beneficiaryOrPayer, setBeneficiaryOrPayer] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  const isExpenseCategory = (cat: FinancialOpCategory) =>
    cat === 'operating_expense' || cat === 'petty_cash_expense';

  const filtered = operations.filter((op) => {
    const isExp = isExpenseCategory(op.opCategory);
    const matchesMode =
      filterMode === 'all' ||
      (filterMode === 'expenses' && isExp) ||
      (filterMode === 'revenues' && !isExp);
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      op.opNo.toLowerCase().includes(q) ||
      op.beneficiaryOrPayer.toLowerCase().includes(q) ||
      op.notes.toLowerCase().includes(q);
    return matchesMode && matchesQuery;
  });

  const totals = useMemo(() => {
    let expenses = 0;
    let revenues = 0;
    for (const op of operations) {
      if (isExpenseCategory(op.opCategory)) expenses += op.totalAmount;
      else revenues += op.totalAmount;
    }
    return { expenses, revenues, net: revenues - expenses };
  }, [operations]);

  const handleCategoryChange = (nextCat: FinancialOpCategory) => {
    setOpCategory(nextCat);
    if (isExpenseCategory(nextCat)) {
      setAccountId(
        nextCat === 'petty_cash_expense'
          ? expenseAccounts.find((a) => a.code === '5203')?.id ?? expenseAccounts[0]?.id ?? ''
          : expenseAccounts.find((a) => a.code === '5204')?.id ?? expenseAccounts[0]?.id ?? ''
      );
      setPaymentAccountId(
        nextCat === 'petty_cash_expense'
          ? cashBankAccounts.find((a) => a.code === '110103')?.id ?? cashBankAccounts[0]?.id ?? ''
          : cashBankAccounts.find((a) => a.code === '110102')?.id ?? cashBankAccounts[0]?.id ?? ''
      );
    } else {
      setAccountId(revenueAccounts[0]?.id ?? '');
      setPaymentAccountId(
        cashBankAccounts.find((a) => a.code === '110101')?.id ?? cashBankAccounts[0]?.id ?? ''
      );
    }
  };

  const handleOpenModal = (defaultCat: FinancialOpCategory) => {
    handleCategoryChange(defaultCat);
    setOpDate(new Date().toISOString().slice(0, 10));
    setAmount('450');
    setIncludeVat(true);
    setBeneficiaryOrPayer('');
    setNotes('');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (Number.isNaN(numAmt) || numAmt <= 0) {
      setFormError('يجب أن يكون المبلغ أكبر من صفر.');
      return;
    }
    if (!accountId || !paymentAccountId || !notes.trim()) {
      setFormError('يرجى تحديد الحساب وحساب النقدية وكتابة البيان.');
      return;
    }
    onRecordOperation({
      opCategory,
      opDate,
      accountId,
      paymentAccountId,
      warehouseId: warehouseId || null,
      amount: numAmt,
      includeVat,
      beneficiaryOrPayer: beneficiaryOrPayer.trim() || '—',
      notes: notes.trim(),
    });
    setShowModal(false);
  };

  const parsedAmount = Number(amount) || 0;
  const previewVat = includeVat ? Number((parsedAmount * 0.15).toFixed(2)) : 0;
  const previewTotal = Number((parsedAmount + previewVat).toFixed(2));
  const selectableTargetAccounts = isExpenseCategory(opCategory)
    ? expenseAccounts
    : revenueAccounts;

  return (
    <div className="space-y-4">
      {/* Totals Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
          <div className="p-4">
            <div className="text-xs text-slate-500">إجمالي المصروفات التشغيلية والنثرية</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-red-700" dir="ltr">
              {totals.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">إجمالي الإيرادات التشغيلية</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
              {totals.revenues.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">صافي التدفق التشغيلي المسجل</div>
            <div
              className={`mt-1 text-lg font-bold font-mono tabular-nums ${
                totals.net >= 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
              dir="ltr"
            >
              {totals.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم العملية أو المستفيد أو البيان..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'expenses', label: 'المصروفات' },
                { id: 'revenues', label: 'الإيرادات' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterMode(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterMode === opt.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenModal('petty_cash_expense')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل مصروف تشغيلي / نثري</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal('operating_revenue')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل إيراد تشغيلي</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-32">رقم العملية</th>
                <th className="py-3 px-4 w-28">التاريخ</th>
                <th className="py-3 px-4">التصنيف والبيان</th>
                <th className="py-3 px-4">الحساب وجهة الصرف/التحصيل</th>
                <th className="py-3 px-4 text-left">المبلغ الصافي</th>
                <th className="py-3 px-4 text-left">الضريبة</th>
                <th className="py-3 px-4 text-left">الإجمالي</th>
                <th className="py-3 px-4 w-28">القيد التلقائي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    لا توجد عمليات مالية مسجلة مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((op) => {
                  const isExp = isExpenseCategory(op.opCategory);
                  const targetAcc = accounts.find((a) => a.id === op.accountId);
                  const payAcc = accounts.find((a) => a.id === op.paymentAccountId);
                  const wh = op.warehouseId
                    ? warehouses.find((w) => w.id === op.warehouseId)
                    : null;

                  return (
                    <tr key={op.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {op.opNo}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {op.opDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <span className={isExp ? 'text-red-700' : 'text-emerald-700'}>
                            {CATEGORY_LABELS[op.opCategory]}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-700 font-normal">
                            {op.beneficiaryOrPayer}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5">{op.notes}</div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-900 font-medium">
                          {targetAcc?.code} · {targetAcc?.nameAr}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          النقدية: {payAcc?.nameAr} {wh ? `· ${wh.code}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs text-slate-700 tabular-nums" dir="ltr">
                        {op.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs text-slate-500 tabular-nums" dir="ltr">
                        {op.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td
                        className={`py-3 px-4 text-left font-mono text-xs font-bold tabular-nums ${
                          isExp ? 'text-red-700' : 'text-emerald-700'
                        }`}
                        dir="ltr"
                      >
                        {op.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => onViewJournalEntry(op.journalEntryId)}
                          className="text-emerald-700 hover:text-emerald-900 underline underline-offset-4 font-medium whitespace-nowrap"
                        >
                          عرض القيد
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

      {/* Record Operation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                تسجيل عملية مالية وتحديث شجرة الحسابات تلقائياً
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تصنيف العملية (op_category)
                  </label>
                  <select
                    value={opCategory}
                    onChange={(e) =>
                      handleCategoryChange(e.target.value as FinancialOpCategory)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {(Object.keys(CATEGORY_LABELS) as FinancialOpCategory[]).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تاريخ العملية
                  </label>
                  <input
                    type="date"
                    value={opDate}
                    onChange={(e) => setOpDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {isExpenseCategory(opCategory)
                      ? 'حساب المصروف (account_id FK)'
                      : 'حساب الإيراد (account_id FK)'}
                  </label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {selectableTargetAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الصندوق / البنك / العهدة (payment_account_id FK)
                  </label>
                  <select
                    value={paymentAccountId}
                    onChange={(e) => setPaymentAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {cashBankAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr} (رصيد:{' '}
                        {a.currentBalance.toLocaleString('en-US')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المبلغ الأساسي (قبل الضريبة)
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    مركز التكلفة / المستودع
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">عام (غير محدد)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الجهة المستفيدة / الدافعة
                  </label>
                  <input
                    type="text"
                    value={beneficiaryOrPayer}
                    onChange={(e) => setBeneficiaryOrPayer(e.target.value)}
                    placeholder="شركة الكهرباء / عميل..."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVat}
                  onChange={(e) => setIncludeVat(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>خاضع لضريبة القيمة المضافة 15% (حساب 2102)</span>
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  البيان التفصيلي (يظهر في قيد اليومية)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: سداد فاتورة كهرباء المستودع المركزي لشهر نوفمبر"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Automatic Journal Preview */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-900">
                  معاينة القيد الآلي وتحديث الشجرة:
                </div>
                <div className="text-slate-600">
                  {isExpenseCategory(opCategory)
                    ? `مدين: حساب المصروف (${parsedAmount.toFixed(2)}) ${
                        includeVat ? `+ ضريبة (${previewVat.toFixed(2)})` : ''
                      } ← دائن: النقدية/العهدة (${previewTotal.toFixed(2)})`
                    : `مدين: النقدية/البنك (${previewTotal.toFixed(2)}) ← دائن: حساب الإيراد (${parsedAmount.toFixed(
                        2
                      )}) ${includeVat ? `+ ضريبة (${previewVat.toFixed(2)})` : ''}`}
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
                  حفظ وترحيل القيد للشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
