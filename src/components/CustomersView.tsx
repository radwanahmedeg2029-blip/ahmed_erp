import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ChartAccount, Customer, CustomerTier, Warehouse } from '../types/erp';

interface CustomersViewProps {
  customers: Customer[];
  accounts: ChartAccount[];
  warehouses: Warehouse[];
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
}

const TIER_LABELS: Record<CustomerTier, string> = {
  retail: 'تجزئة (Retail)',
  wholesale: 'جملة (Wholesale)',
  corporate: 'شركات (Corporate)',
  vip: 'كبار العملاء (VIP)',
};

export function CustomersView({
  customers,
  accounts,
  warehouses,
  onAddCustomer,
}: CustomersViewProps) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<CustomerTier | 'all'>('all');
  const [showModal, setShowModal] = useState(false);

  const receivableAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'asset' && a.isPostable),
    [accounts]
  );

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [customerTier, setCustomerTier] = useState<CustomerTier>('wholesale');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [receivableAccountId, setReceivableAccountId] = useState(
    receivableAccounts.find((a) => a.code.startsWith('1102'))?.id ??
      receivableAccounts[0]?.id ??
      ''
  );
  const [defaultWarehouseId, setDefaultWarehouseId] = useState(
    warehouses[0]?.id ?? ''
  );
  const [formError, setFormError] = useState('');

  const filtered = customers.filter((c) => {
    const matchesTier = tierFilter === 'all' || c.customerTier === tierFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.taxNumber.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q);
    return matchesTier && matchesQuery;
  });

  const handleOpenModal = () => {
    setCode(`CUS-${1001 + customers.length}`);
    setNameAr('');
    setNameEn('');
    setCustomerTier('wholesale');
    setTaxNumber('');
    setPhone('');
    setEmail('');
    setCity('');
    setCreditLimit('50000');
    setPaymentTermsDays('30');
    setReceivableAccountId(
      receivableAccounts.find((a) => a.code.startsWith('1102'))?.id ??
        receivableAccounts[0]?.id ??
        ''
    );
    setDefaultWarehouseId(warehouses[0]?.id ?? '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const limit = Number(creditLimit);
    const terms = Number(paymentTermsDays);
    if (!code.trim() || !nameAr.trim() || !receivableAccountId) {
      setFormError('يرجى إدخال رمز العميل والاسم العربي واختيار حساب الذمم المدينة.');
      return;
    }
    if (customers.some((c) => c.code.toLowerCase() === code.trim().toLowerCase())) {
      setFormError('رمز العميل مستخدم مسبقاً (قيد UNIQUE على عمود code).');
      return;
    }
    if (Number.isNaN(limit) || limit < 0 || Number.isNaN(terms) || terms < 0) {
      setFormError('الحد الائتماني وأيام الاستحقاق يجب أن تكون قيماً غير سالبة.');
      return;
    }

    onAddCustomer({
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      customerTier,
      taxNumber: taxNumber.trim() || '—',
      phone: phone.trim() || '—',
      email: email.trim() || '—',
      city: city.trim() || 'غير محدد',
      creditLimit: limit,
      currentBalance: 0,
      paymentTermsDays: terms,
      receivableAccountId,
      defaultWarehouseId: defaultWarehouseId || null,
      isActive: true,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الرمز أو الرقم الضريبي..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'retail', 'wholesale', 'corporate', 'vip'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  tierFilter === t
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'كل الزوايا' : TIER_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">الرمز</th>
                <th className="py-3 px-4">العميل والزاوية (Tier)</th>
                <th className="py-3 px-4">الرقم الضريبي والمدينة</th>
                <th className="py-3 px-4 text-left">الحد الائتماني</th>
                <th className="py-3 px-4 text-left">الرصيد الحالي</th>
                <th className="py-3 px-4 w-44">استهلاك الائتمان</th>
                <th className="py-3 px-4">الحساب والمستودع (FK)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    لا توجد سجلات عملاء مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((cust) => {
                  const account = accounts.find((a) => a.id === cust.receivableAccountId);
                  const wh = cust.defaultWarehouseId
                    ? warehouses.find((w) => w.id === cust.defaultWarehouseId)
                    : null;
                  const utilization =
                    cust.creditLimit > 0
                      ? Math.min(100, Math.round((cust.currentBalance / cust.creditLimit) * 100))
                      : 0;
                  const barColor =
                    utilization >= 90
                      ? 'bg-red-600'
                      : utilization >= 75
                      ? 'bg-amber-500'
                      : 'bg-emerald-600';

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {cust.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{cust.nameAr}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {TIER_LABELS[cust.customerTier]} · استحقاق{' '}
                          <span className="font-mono tabular-nums">{cust.paymentTermsDays}</span> يوم
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-mono text-slate-700 tabular-nums" dir="ltr">
                          {cust.taxNumber}
                        </div>
                        <div className="text-slate-500 mt-0.5">{cust.city}</div>
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {cust.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-800 tabular-nums" dir="ltr">
                        {cust.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4">
                        {cust.creditLimit > 0 ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                              <span
                                className={
                                  utilization >= 90
                                    ? 'text-red-700 font-semibold'
                                    : utilization >= 75
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-emerald-700 font-semibold'
                                }
                              >
                                {utilization}%
                              </span>
                              <span className="text-slate-400">
                                متاح:{' '}
                                {(cust.creditLimit - cust.currentBalance).toLocaleString('en-US')}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor}`}
                                style={{ width: `${utilization}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">نقدي (بدون سقف)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <div className="font-mono text-emerald-700 font-semibold tabular-nums">
                          {account?.code ?? '—'}
                        </div>
                        <div className="text-slate-500 mt-0.5 truncate max-w-[160px]">
                          {wh?.nameAr ?? '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                إضافة عميل جديد وتحديد الحد الائتماني
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
                    رمز العميل (code)
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
                    زاوية / تصنيف العميل
                  </label>
                  <select
                    value={customerTier}
                    onChange={(e) => setCustomerTier(e.target.value as CustomerTier)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => (
                      <option key={t} value={t}>
                        {TIER_LABELS[t]}
                      </option>
                    ))}
                  </select>
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
                    placeholder="310000000000003"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    اسم العميل بالعربية (name_ar)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: شركة الرواد للتجهيزات"
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
                    placeholder="Al-Rowad Supplies Co."
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الحد الائتماني (credit_limit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
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
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المدينة
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="الرياض"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب ذمم العميل (receivable_account_id FK)
                  </label>
                  <select
                    value={receivableAccountId}
                    onChange={(e) => setReceivableAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {receivableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المستودع الافتراضي للعميل (FK)
                  </label>
                  <select
                    value={defaultWarehouseId}
                    onChange={(e) => setDefaultWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.nameAr}
                      </option>
                    ))}
                  </select>
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
                  حفظ العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
