import { useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ChartAccount, Warehouse } from '../types/erp';

interface WarehousesViewProps {
  warehouses: Warehouse[];
  accounts: ChartAccount[];
  onAddWarehouse: (wh: Omit<Warehouse, 'id'>) => void;
  onSetDefault: (id: string) => void;
}

export function WarehousesView({
  warehouses,
  accounts,
  onAddWarehouse,
  onSetDefault,
}: WarehousesViewProps) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const inventoryAccounts = accounts.filter(
    (a) => a.accountType === 'asset' && a.isPostable
  );

  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [location, setLocation] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [inventoryAccountId, setInventoryAccountId] = useState(
    inventoryAccounts[0]?.id ?? ''
  );
  const [isDefault, setIsDefault] = useState(false);
  const [formError, setFormError] = useState('');

  const filtered = warehouses.filter((w) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      w.code.toLowerCase().includes(q) ||
      w.nameAr.toLowerCase().includes(q) ||
      w.location.toLowerCase().includes(q) ||
      w.managerName.toLowerCase().includes(q)
    );
  });

  const handleOpenModal = () => {
    setCode(`WH-${String(warehouses.length + 1).padStart(2, '0')}`);
    setNameAr('');
    setNameEn('');
    setLocation('');
    setManagerName('');
    setPhone('');
    setInventoryAccountId(inventoryAccounts[0]?.id ?? '');
    setIsDefault(false);
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !nameAr.trim() || !inventoryAccountId) {
      setFormError('يرجى إدخال رمز المستودع واسمه واختيار حساب المخزون المرتبط.');
      return;
    }
    if (warehouses.some((w) => w.code.toLowerCase() === code.trim().toLowerCase())) {
      setFormError('رمز المستودع مستخدم مسبقاً (قيد UNIQUE على عمود code).');
      return;
    }
    onAddWarehouse({
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      location: location.trim() || 'غير محدد',
      managerName: managerName.trim() || 'غير محدد',
      phone: phone.trim() || '—',
      inventoryAccountId,
      isDefault,
      isActive: true,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في المستودعات أو الموقع أو المسؤول..."
            className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
          />
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مستودع جديد</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">الرمز</th>
                <th className="py-3 px-4">اسم المستودع والموقع</th>
                <th className="py-3 px-4">أمين المستودع</th>
                <th className="py-3 px-4">حساب المخزون المرتبط (FK)</th>
                <th className="py-3 px-4 w-36">الحالة الافتراضية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-500">
                    لا توجد مستودعات مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filtered.map((wh) => {
                  const account = accounts.find((a) => a.id === wh.inventoryAccountId);
                  return (
                    <tr key={wh.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {wh.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{wh.nameAr}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{wh.location}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs font-medium text-slate-800">{wh.managerName}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5" dir="ltr">
                          {wh.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {account ? (
                          <div className="text-xs">
                            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                              {account.code}
                            </span>
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-800">{account.nameAr}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {wh.isDefault ? (
                          <span className="font-semibold text-emerald-700">المستودع الافتراضي</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetDefault(wh.id)}
                            className="text-emerald-700 hover:text-emerald-900 underline underline-offset-4 whitespace-nowrap"
                          >
                            تعيين كافتراضي
                          </button>
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

      {/* Add Warehouse Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة مستودع جديد</h3>
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
                    رمز المستودع (code)
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
                    الاسم الإنجليزي
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    dir="ltr"
                    placeholder="Dammam Branch Store"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  اسم المستودع بالعربية (name_ar)
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: مستودع المنطقة الشرقية — الدمام"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  حساب المخزون في شجرة الحسابات (inventory_account_id FK)
                </label>
                <select
                  value={inventoryAccountId}
                  onChange={(e) => setInventoryAccountId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  {inventoryAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.code} — {acc.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الموقع / العنوان
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="المدينة الصناعية، الدمام"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    أمين المستودع
                  </label>
                  <input
                    type="text"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                    placeholder="اسم المسؤول"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>تعيين كمستودع افتراضي للنظام (is_default = TRUE)</span>
              </label>

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
                  حفظ المستودع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
