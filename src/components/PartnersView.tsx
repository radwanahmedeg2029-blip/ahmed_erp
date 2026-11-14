import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ChartAccount,
  NormalBalance,
  Partner,
  PartnerCurrentTx,
  PartnerTxType,
} from '../types/erp';

interface PartnersViewProps {
  partners: Partner[];
  transactions: PartnerCurrentTx[];
  accounts: ChartAccount[];
  onAddPartner: (partner: Omit<Partner, 'id'>) => void;
  onAddTransaction: (tx: Omit<PartnerCurrentTx, 'id'>) => void;
}

const TX_TYPE_META: Record<
  PartnerTxType,
  { label: string; defaultDirection: NormalBalance }
> = {
  capital_injection: { label: 'إيداع / زيادة رأس مال', defaultDirection: 'credit' },
  drawing: { label: 'مسحوبات شخصية', defaultDirection: 'debit' },
  profit_share: { label: 'توزيع حصة أرباح', defaultDirection: 'credit' },
  loss_share: { label: 'تحميل حصة خسارة', defaultDirection: 'debit' },
  loan_to_company: { label: 'تمويل / قرض للشركة', defaultDirection: 'credit' },
};

export function PartnersView({
  partners,
  transactions,
  accounts,
  onAddPartner,
  onAddTransaction,
}: PartnersViewProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showTxModal, setShowTxModal] = useState(false);

  const equityAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'equity' && a.isPostable),
    [accounts]
  );

  // Add Partner state
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [ownershipPercent, setOwnershipPercent] = useState('10');
  const [capitalContribution, setCapitalContribution] = useState('100000');
  const [capitalAccountId, setCapitalAccountId] = useState(
    equityAccounts.find((a) => a.code === '3101')?.id ?? equityAccounts[0]?.id ?? ''
  );
  const [currentAccountId, setCurrentAccountId] = useState(
    equityAccounts.find((a) => a.code === '3103')?.id ?? equityAccounts[0]?.id ?? ''
  );
  const [partnerError, setPartnerError] = useState('');

  // Add Tx state
  const [txPartnerId, setTxPartnerId] = useState(partners[0]?.id ?? '');
  const [txType, setTxType] = useState<PartnerTxType>('drawing');
  const [txAmount, setTxAmount] = useState('5000');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 10));
  const [txRef, setTxRef] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txError, setTxError] = useState('');

  const partnerBalances = useMemo(() => {
    const map = new Map<string, { credits: number; debits: number; net: number }>();
    for (const p of partners) {
      map.set(p.id, { credits: 0, debits: 0, net: 0 });
    }
    for (const tx of transactions) {
      const entry = map.get(tx.partnerId) ?? { credits: 0, debits: 0, net: 0 };
      if (tx.direction === 'credit') entry.credits += tx.amount;
      else entry.debits += tx.amount;
      entry.net = entry.credits - entry.debits;
      map.set(tx.partnerId, entry);
    }
    return map;
  }, [partners, transactions]);

  const totalCapital = useMemo(
    () => partners.reduce((s, p) => s + p.capitalContribution, 0),
    [partners]
  );
  const totalOwnership = useMemo(
    () => partners.reduce((s, p) => s + p.ownershipPercent, 0),
    [partners]
  );
  const totalCurrentNet = useMemo(() => {
    let sum = 0;
    for (const val of partnerBalances.values()) sum += val.net;
    return sum;
  }, [partnerBalances]);

  const filteredTxs = useMemo(() => {
    return transactions
      .filter((t) => selectedPartnerId === 'all' || t.partnerId === selectedPartnerId)
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [transactions, selectedPartnerId]);

  const handleOpenPartnerModal = () => {
    setCode(`PRT-${String(partners.length + 1).padStart(2, '0')}`);
    setNameAr('');
    setNameEn('');
    setNationalId('');
    setPhone('');
    setOwnershipPercent('10');
    setCapitalContribution('100000');
    setCapitalAccountId(
      equityAccounts.find((a) => a.code === '3101')?.id ?? equityAccounts[0]?.id ?? ''
    );
    setCurrentAccountId(
      equityAccounts.find((a) => a.code === '3103')?.id ?? equityAccounts[0]?.id ?? ''
    );
    setPartnerError('');
    setShowPartnerModal(true);
  };

  const handlePartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pct = Number(ownershipPercent);
    const cap = Number(capitalContribution);
    if (!code.trim() || !nameAr.trim()) {
      setPartnerError('يرجى إدخال رمز الشريك واسمه الكامل.');
      return;
    }
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      setPartnerError('نسبة الشراكة يجب أن تكون بين 0.01 و 100%.');
      return;
    }
    if (partners.some((p) => p.code.toLowerCase() === code.trim().toLowerCase())) {
      setPartnerError('رمز الشريك مستخدم مسبقاً.');
      return;
    }

    onAddPartner({
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      nationalId: nationalId.trim() || '—',
      phone: phone.trim() || '—',
      ownershipPercent: pct,
      capitalContribution: Number.isNaN(cap) ? 0 : Math.max(0, cap),
      capitalAccountId,
      currentAccountId,
      isActive: true,
    });
    setShowPartnerModal(false);
  };

  const handleOpenTxModal = () => {
    setTxPartnerId(selectedPartnerId !== 'all' ? selectedPartnerId : partners[0]?.id ?? '');
    setTxType('drawing');
    setTxAmount('5000');
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxRef(`PTX-2026-${String(transactions.length + 1).padStart(3, '0')}`);
    setTxNotes('');
    setTxError('');
    setShowTxModal(true);
  };

  const handleTxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(txAmount);
    if (!txPartnerId || Number.isNaN(amt) || amt <= 0) {
      setTxError('يرجى اختيار الشريك وإدخال مبلغ أكبر من صفر.');
      return;
    }
    onAddTransaction({
      partnerId: txPartnerId,
      transactionDate: txDate,
      transactionType: txType,
      direction: TX_TYPE_META[txType].defaultDirection,
      amount: amt,
      referenceNo: txRef.trim() || '—',
      notes: txNotes.trim() || TX_TYPE_META[txType].label,
    });
    setShowTxModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Capital & Current Account Summary Strip */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              الشركاء ورأس المال وجاري الشركاء
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              فصل رأس المال الثابت عن حركات المسحوبات والأرباح في دفتر جاري الشركاء.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleOpenTxModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل حركة جاري شريك</span>
            </button>
            <button
              type="button"
              onClick={handleOpenPartnerModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة شريك</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200">
          <div className="p-4">
            <div className="text-xs text-slate-500">إجمالي رأس المال المساهم</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-slate-900" dir="ltr">
              {totalCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">مجموع نسب الملكية</div>
            <div
              className={`mt-1 text-lg font-bold font-mono tabular-nums ${
                Math.abs(totalOwnership - 100) < 0.01 ? 'text-emerald-700' : 'text-amber-700'
              }`}
              dir="ltr"
            >
              {totalOwnership.toFixed(2)}%
            </div>
          </div>
          <div className="p-4">
            <div className="text-xs text-slate-500">صافي أرصدة جاري الشركاء (دائن - مدين)</div>
            <div className="mt-1 text-lg font-bold font-mono tabular-nums text-emerald-700" dir="ltr">
              {totalCurrentNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Partners Master Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">جدول الشركاء (partners)</h3>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {partners.length} شركاء
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-24">الرمز</th>
                <th className="py-3 px-4">اسم الشريك</th>
                <th className="py-3 px-4 text-left w-28">نسبة الملكية</th>
                <th className="py-3 px-4 text-left">حصة رأس المال</th>
                <th className="py-3 px-4 text-left">إجمالي الدائن (أرباح/إيداع)</th>
                <th className="py-3 px-4 text-left">إجمالي المدين (مسحوبات)</th>
                <th className="py-3 px-4 text-left">صافي رصيد الجاري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {partners.map((p) => {
                const bal = partnerBalances.get(p.id) ?? { credits: 0, debits: 0, net: 0 };
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                      {p.code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{p.nameAr}</div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                        هوية: {p.nationalId} · {p.phone}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                      {p.ownershipPercent.toFixed(2)}%
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                      {p.capitalContribution.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-xs text-emerald-700 tabular-nums" dir="ltr">
                      {bal.credits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-xs text-red-700 tabular-nums" dir="ltr">
                      {bal.debits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`py-3 px-4 text-left font-mono text-xs font-bold tabular-nums ${
                        bal.net >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                      dir="ltr"
                    >
                      {bal.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Current Account Ledger Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">
            سجل حركات جاري الشركاء (partner_current_accounts)
          </h3>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedPartnerId('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                selectedPartnerId === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              جميع الشركاء
            </button>
            {partners.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPartnerId(p.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedPartnerId === p.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.nameAr.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">التاريخ</th>
                <th className="py-3 px-4 w-32">المرجع</th>
                <th className="py-3 px-4">الشريك (FK)</th>
                <th className="py-3 px-4">نوع الحركة</th>
                <th className="py-3 px-4 w-28">التوجيه</th>
                <th className="py-3 px-4 text-left w-32">المبلغ</th>
                <th className="py-3 px-4">البيان / الملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTxs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                    لا توجد حركات مسجلة لهذا الشريك.
                  </td>
                </tr>
              ) : (
                filteredTxs.map((tx) => {
                  const partner = partners.find((p) => p.id === tx.partnerId);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {tx.transactionDate}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {tx.referenceNo}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-900">
                        {partner?.nameAr ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {TX_TYPE_META[tx.transactionType].label}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {tx.direction === 'credit' ? (
                          <span className="text-emerald-700">دائن (له)</span>
                        ) : (
                          <span className="text-red-700">مدين (عليه)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{tx.notes}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Partner Modal */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة شريك جديد</h3>
              <button
                type="button"
                onClick={() => setShowPartnerModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="p-6 space-y-4">
              {partnerError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {partnerError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رمز الشريك (code)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رقم الهوية
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  اسم الشريك بالعربية
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    نسبة الملكية (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100"
                    value={ownershipPercent}
                    onChange={(e) => setOwnershipPercent(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حصة رأس المال
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={capitalContribution}
                    onChange={(e) => setCapitalContribution(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب رأس المال (FK)
                  </label>
                  <select
                    value={capitalAccountId}
                    onChange={(e) => setCapitalAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {equityAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب جاري الشريك (FK)
                  </label>
                  <select
                    value={currentAccountId}
                    onChange={(e) => setCurrentAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {equityAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  حفظ الشريك
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Partner Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                تسجيل حركة على جاري الشريك
              </h3>
              <button
                type="button"
                onClick={() => setShowTxModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTxSubmit} className="p-6 space-y-4">
              {txError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {txError}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  الشريك (partner_id FK)
                </label>
                <select
                  value={txPartnerId}
                  onChange={(e) => setTxPartnerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    نوع الحركة (transaction_type)
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as PartnerTxType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {(Object.keys(TX_TYPE_META) as PartnerTxType[]).map((key) => (
                      <option key={key} value={key}>
                        {TX_TYPE_META[key].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المبلغ
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={txAmount}
                    onChange={(e) => setTxAmount(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    تاريخ الحركة
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رقم المرجع / السند
                  </label>
                  <input
                    type="text"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  البيان والملاحظات
                </label>
                <input
                  type="text"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  placeholder="تفاصيل سند الصرف أو القيد"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTxModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  ترحيل الحركة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
