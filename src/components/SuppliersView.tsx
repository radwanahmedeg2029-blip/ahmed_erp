import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ChartAccount, Supplier } from '../types/erp';

interface SuppliersViewProps {
  suppliers: Supplier[];
  accounts: ChartAccount[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
}

export function SuppliersView({
  suppliers,
  accounts,
  onAddSupplier,
}: SuppliersViewProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const payableAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'liability' && a.isPostable),
    [accounts]
  );

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [payableAccountId, setPayableAccountId] = useState(
    payableAccounts[0]?.id ?? ''
  );
  const [formError, setFormError] = useState('');

  const filtered = suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.nameAr.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.taxNumber.toLowerCase().includes(q)
    );
  });

  const handleOpenModal = () => {
    setCode(`SUP-${2001 + suppliers.length}`);
    setNameAr('');
    setNameEn('');
    setTaxNumber('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setCity('');
    setPaymentTermsDays('30');
    setPayableAccountId(payableAccounts[0]?.id ?? '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const terms = Number(paymentTermsDays);
    if (!code.trim() || !nameAr.trim() || !payableAccountId) {
      setFormError('يرجى إدخال رمز المورد واسمه واختيار حساب الموردين الدائن.');
      return;
    }
    if (suppliers.some((s) => s.code.toLowerCase() === code.trim().toLowerCase())) {
      setFormError('رمز المورد مستخدم مسبقاً (قيد UNIQUE على عمود code).');
      return;
    }

    onAddSupplier({
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      taxNumber: taxNumber.trim() || '—',
      contactPerson: contactPerson.trim() || 'غير محدد',
      phone: phone.trim() || '—',
      email: email.trim() || '—',
      city: city.trim() || 'غير محدد',
      paymentTermsDays: Number.isNaN(terms) ? 30 : Math.max(0, terms),
      currentBalance: 0,
      payableAccountId,
      isActive: true,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم المورد أو الرقم الضريبي أو المسؤول..."
            className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-80 max-w-full"
          />
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">الرمز</th>
                <th className="py-3 px-4">المورد والمدينة</th>
                <th className="py-3 px-4">الرقم الضريبي</th>
                <th className="py-3 px-4">مسؤول التواصل</th>
                <th className="py-3 px-4 w-28">شروط السداد</th>
                <th className="py-3 px-4 text-left w-32">الرصيد الدائن</th>
                <th className="py-3 px-4">الحساب الدائن (FK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    لا توجد سجلات موردين مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((sup) => {
                  const acc = accounts.find((a) => a.id === sup.payableAccountId);
                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {sup.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{sup.nameAr}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {sup.city} · {sup.nameEn}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 tabular-nums" dir="ltr">
                        {sup.taxNumber}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-800">{sup.contactPerson}</div>
                        <div className="text-slate-500 font-mono tabular-nums mt-0.5" dir="ltr">
                          {sup.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-700">
                        {sup.paymentTermsDays} يوم
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {sup.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {acc ? (
                          <span>
                            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                              {acc.code}
                            </span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="text-slate-700">{acc.nameAr}</span>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة مورد جديد</h3>
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
                    رمز المورد (code)
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
                    الرقم الضريبي
                  </label>
                  <input
                    type="text"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    اسم المورد بالعربية
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="شركة الإمداد الحديثة"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم الإنجليزي
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    dir="ltr"
                    placeholder="Modern Supply Co."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    مسؤول التواصل
                  </label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رقم الهاتف
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المدينة
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب الموردين الدائن (payable_account_id FK)
                  </label>
                  <select
                    value={payableAccountId}
                    onChange={(e) => setPayableAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {payableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    مهلة السداد (أيام)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={paymentTermsDays}
                    onChange={(e) => setPaymentTermsDays(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
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
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
