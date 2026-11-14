import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import {
  ChartAccount,
  Customer,
  Partner,
  PaymentMethod,
  Supplier,
  Voucher,
  VoucherPartyType,
  VoucherType,
} from '../types/erp';

interface VouchersViewProps {
  vouchers: Voucher[];
  accounts: ChartAccount[];
  customers: Customer[];
  suppliers: Supplier[];
  partners: Partner[];
  onPostVoucher: (payload: {
    voucherType: VoucherType;
    voucherDate: string;
    paymentMethod: PaymentMethod;
    cashBankAccountId: string;
    counterAccountId: string;
    partyType: VoucherPartyType;
    partyId: string | null;
    partyLabel: string;
    amount: number;
    referenceNo: string;
    description: string;
  }) => void;
  onViewJournalEntry: (entryId: string) => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'نقدي (صندوق)',
  bank_transfer: 'تحويل بنكي',
  cheque: 'شيك',
  pos_card: 'شبكة / بطاقة',
};

export function VouchersView({
  vouchers,
  accounts,
  customers,
  suppliers,
  partners,
  onPostVoucher,
  onViewJournalEntry,
}: VouchersViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VoucherType>('all');
  const [showModal, setShowModal] = useState(false);

  const cashBankAccounts = useMemo(
    () => accounts.filter((a) => a.code.startsWith('1101') && a.isPostable),
    [accounts]
  );
  const allPostableAccounts = useMemo(
    () => accounts.filter((a) => a.isPostable),
    [accounts]
  );

  // Modal state
  const [voucherType, setVoucherType] = useState<VoucherType>('receipt');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [cashBankAccountId, setCashBankAccountId] = useState(
    cashBankAccounts.find((a) => a.code === '110102')?.id ?? cashBankAccounts[0]?.id ?? ''
  );
  const [partyType, setPartyType] = useState<VoucherPartyType>('customer');
  const [partyId, setPartyId] = useState(customers[0]?.id ?? '');
  const [counterAccountId, setCounterAccountId] = useState(
    customers[0]?.receivableAccountId ?? allPostableAccounts[0]?.id ?? ''
  );
  const [amount, setAmount] = useState('15000');
  const [referenceNo, setReferenceNo] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');

  const totals = useMemo(() => {
    let receipts = 0;
    let payments = 0;
    for (const v of vouchers) {
      if (v.voucherType === 'receipt') receipts += v.amount;
      else payments += v.amount;
    }
    return { receipts, payments, net: receipts - payments };
  }, [vouchers]);

  const filtered = vouchers.filter((v) => {
    const matchesType = typeFilter === 'all' || v.voucherType === typeFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      v.voucherNo.toLowerCase().includes(q) ||
      v.partyLabel.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.referenceNo.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  const handlePartyTypeChange = (nextPartyType: VoucherPartyType) => {
    setPartyType(nextPartyType);
    if (nextPartyType === 'customer') {
      const c = customers[0];
      setPartyId(c?.id ?? '');
      if (c) setCounterAccountId(c.receivableAccountId);
    } else if (nextPartyType === 'supplier') {
      const s = suppliers[0];
      setPartyId(s?.id ?? '');
      if (s) setCounterAccountId(s.payableAccountId);
    } else if (nextPartyType === 'partner') {
      const p = partners[0];
      setPartyId(p?.id ?? '');
      if (p) setCounterAccountId(p.currentAccountId);
    } else {
      setPartyId('');
    }
  };

  const handleOpenModal = (defaultType: VoucherType) => {
    setVoucherType(defaultType);
    setVoucherDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod('bank_transfer');
    setCashBankAccountId(
      cashBankAccounts.find((a) => a.code === '110102')?.id ?? cashBankAccounts[0]?.id ?? ''
    );
    handlePartyTypeChange(defaultType === 'receipt' ? 'customer' : 'supplier');
    setAmount('10000');
    setReferenceNo('');
    setDescription('');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = Number(amount);
    if (Number.isNaN(numAmt) || numAmt <= 0) {
      setFormError('يجب أن يكون مبلغ السند أكبر من صفر.');
      return;
    }
    if (!cashBankAccountId || !counterAccountId || !description.trim()) {
      setFormError('يرجى تحديد حساب الصندوق/البنك والحساب المقابل وكتابة البيان.');
      return;
    }

    let partyLabel = 'حساب عام';
    if (partyType === 'customer') {
      partyLabel = customers.find((c) => c.id === partyId)?.nameAr ?? 'عميل';
    } else if (partyType === 'supplier') {
      partyLabel = suppliers.find((s) => s.id === partyId)?.nameAr ?? 'مورد';
    } else if (partyType === 'partner') {
      partyLabel = partners.find((p) => p.id === partyId)?.nameAr ?? 'شريك';
    } else {
      partyLabel =
        allPostableAccounts.find((a) => a.id === counterAccountId)?.nameAr ?? 'حساب عام';
    }

    onPostVoucher({
      voucherType,
      voucherDate,
      paymentMethod,
      cashBankAccountId,
      counterAccountId,
      partyType,
      partyId: partyType === 'other' ? null : partyId || null,
      partyLabel,
      amount: numAmt,
      referenceNo: referenceNo.trim() || '—',
      description: description.trim(),
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Totals Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
          <div className="p-4">
            <div className="text-xs text-slate-500">إجمالي سندات القبض (تحصيل)</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
              {totals.receipts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">إجمالي سندات الصرف (مدفوعات)</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-red-700" dir="ltr">
              {totals.payments.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">صافي الحركة النقدية والبنكية للسندات</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
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
              placeholder="بحث برقم السند أو الطرف أو المرجع..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'كل السندات' },
                { id: 'receipt', label: 'سندات القبض (RV)' },
                { id: 'payment', label: 'سندات الصرف (PV)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTypeFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  typeFilter === opt.id
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
            onClick={() => handleOpenModal('receipt')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>سند قبض جديد</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal('payment')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>سند صرف جديد</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-32">رقم السند</th>
                <th className="py-3 px-4 w-28">التاريخ</th>
                <th className="py-3 px-4 w-28">النوع</th>
                <th className="py-3 px-4">الطرف المستلم / الدافع والبيان</th>
                <th className="py-3 px-4">حساب الخزينة / البنك</th>
                <th className="py-3 px-4 text-left w-32">المبلغ</th>
                <th className="py-3 px-4 w-28">القيد المولد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    لا توجد سندات مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const cashAcc = accounts.find((a) => a.id === v.cashBankAccountId);
                  const counterAcc = accounts.find((a) => a.id === v.counterAccountId);
                  const isReceipt = v.voucherType === 'receipt';

                  return (
                    <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {v.voucherNo}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums">
                        {v.voucherDate}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {isReceipt ? (
                          <span className="text-emerald-700">سند قبض</span>
                        ) : (
                          <span className="text-red-700">سند صرف</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{v.partyLabel}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {v.description} · مرجع: <span className="font-mono">{v.referenceNo}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-900 font-medium">
                          {cashAcc?.code} · {cashAcc?.nameAr}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {METHOD_LABELS[v.paymentMethod]} · مقابل: {counterAcc?.code}
                        </div>
                      </td>
                      <td
                        className={`py-3 px-4 text-left font-mono text-xs font-bold tabular-nums ${
                          isReceipt ? 'text-emerald-700' : 'text-red-700'
                        }`}
                        dir="ltr"
                      >
                        {v.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => onViewJournalEntry(v.journalEntryId)}
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

      {/* Create Voucher Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                {voucherType === 'receipt' ? 'إصدار سند قبض (Receipt Voucher)' : 'إصدار سند صرف (Payment Voucher)'}
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
                    نوع السند
                  </label>
                  <select
                    value={voucherType}
                    onChange={(e) => setVoucherType(e.target.value as VoucherType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="receipt">سند قبض (تحصيل)</option>
                    <option value="payment">سند صرف (دفع)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تاريخ السند
                  </label>
                  <input
                    type="date"
                    value={voucherDate}
                    onChange={(e) => setVoucherDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    طريقة الدفع / التحصيل
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب الصندوق / البنك (cash_bank_account_id FK)
                  </label>
                  <select
                    value={cashBankAccountId}
                    onChange={(e) => setCashBankAccountId(e.target.value)}
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

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    نوع الطرف (party_type)
                  </label>
                  <select
                    value={partyType}
                    onChange={(e) =>
                      handlePartyTypeChange(e.target.value as VoucherPartyType)
                    }
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="customer">عميل (تحديث ذمة العميل تلقائياً)</option>
                    <option value="supplier">مورد (تحديث ذمة المورد تلقائياً)</option>
                    <option value="partner">شريك (جاري الشركاء)</option>
                    <option value="other">حساب عام من الشجرة</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {partyType !== 'other' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {partyType === 'customer'
                        ? 'العميل'
                        : partyType === 'supplier'
                        ? 'المورد'
                        : 'الشريك'}
                    </label>
                    <select
                      value={partyId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setPartyId(nextId);
                        if (partyType === 'customer') {
                          const c = customers.find((x) => x.id === nextId);
                          if (c) setCounterAccountId(c.receivableAccountId);
                        } else if (partyType === 'supplier') {
                          const s = suppliers.find((x) => x.id === nextId);
                          if (s) setCounterAccountId(s.payableAccountId);
                        } else if (partyType === 'partner') {
                          const p = partners.find((x) => x.id === nextId);
                          if (p) setCounterAccountId(p.currentAccountId);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    >
                      {partyType === 'customer' &&
                        customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.nameAr} (رصيد:{' '}
                            {c.currentBalance.toLocaleString('en-US')})
                          </option>
                        ))}
                      {partyType === 'supplier' &&
                        suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.nameAr} (رصيد:{' '}
                            {s.currentBalance.toLocaleString('en-US')})
                          </option>
                        ))}
                      {partyType === 'partner' &&
                        partners.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code} — {p.nameAr}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className={partyType === 'other' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الحساب المقابل في الشجرة (counter_account_id FK)
                  </label>
                  <select
                    value={counterAccountId}
                    onChange={(e) => setCounterAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {allPostableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المبلغ (amount)
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
                    رقم الشيك / الحوالة المرجعي
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    dir="ltr"
                    placeholder="TRF-90211"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  البيان
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="مثال: سداد دفعة من مستحقات الفاتورة الآجلة"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">التأثير المحاسبي التلقائي: </span>
                {voucherType === 'receipt'
                  ? 'مدين (الصندوق/البنك) ← دائن (الحساب المقابل)، مع تخفيض ذمة العميل وتحديث أرصدة شجرة الحسابات صعوداً.'
                  : 'مدين (الحساب المقابل) ← دائن (الصندوق/البنك)، مع تخفيض ذمة المورد وتحديث أرصدة شجرة الحسابات صعوداً.'}
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
                  حفظ السند وتحديث الشجرة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
