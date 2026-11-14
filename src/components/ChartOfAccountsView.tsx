import { useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus, Search, X } from 'lucide-react';
import { AccountType, ChartAccount, NormalBalance } from '../types/erp';

interface ChartOfAccountsViewProps {
  accounts: ChartAccount[];
  onAddAccount: (account: Omit<ChartAccount, 'id'>) => void;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  asset: 'الأصول',
  liability: 'الخصوم',
  equity: 'حقوق الملكية',
  revenue: 'الإيرادات',
  expense: 'المصروفات',
};

const DEFAULT_BALANCE_BY_TYPE: Record<AccountType, NormalBalance> = {
  asset: 'debit',
  expense: 'debit',
  liability: 'credit',
  equity: 'credit',
  revenue: 'credit',
};

export function ChartOfAccountsView({
  accounts,
  onAddAccount,
}: ChartOfAccountsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AccountType | 'all'>('all');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  // Add account form state
  const [parentId, setParentId] = useState<string>('acc-1103');
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [isPostable, setIsPostable] = useState(true);
  const [formError, setFormError] = useState('');

  const parentOptions = useMemo(
    () => accounts.filter((a) => !a.isPostable),
    [accounts]
  );

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Build ordered flat tree rows
  const orderedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query || typeFilter !== 'all') {
      return accounts
        .filter((acc) => {
          const matchesType = typeFilter === 'all' || acc.accountType === typeFilter;
          const matchesQuery =
            !query ||
            acc.code.toLowerCase().includes(query) ||
            acc.nameAr.toLowerCase().includes(query) ||
            acc.nameEn.toLowerCase().includes(query);
          return matchesType && matchesQuery;
        })
        .sort((a, b) => a.code.localeCompare(b.code));
    }

    const byParent = new Map<string | null, ChartAccount[]>();
    for (const acc of accounts) {
      const list = byParent.get(acc.parentId) ?? [];
      list.push(acc);
      byParent.set(acc.parentId, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => a.code.localeCompare(b.code));
    }

    const result: (ChartAccount & { hasChildren: boolean })[] = [];
    const visit = (parent: string | null) => {
      const children = byParent.get(parent) ?? [];
      for (const child of children) {
        const sub = byParent.get(child.id) ?? [];
        const hasChildren = sub.length > 0;
        result.push({ ...child, hasChildren });
        if (hasChildren && !collapsedIds.has(child.id)) {
          visit(child.id);
        }
      }
    };
    visit(null);
    return result.map((r) => ({ ...r }));
  }, [accounts, search, typeFilter, collapsedIds]);

  const handleOpenModal = () => {
    const selectedParent = accounts.find((a) => a.id === parentId) ?? parentOptions[0];
    if (selectedParent) {
      const siblings = accounts.filter((a) => a.parentId === selectedParent.id);
      const nextSuffix = String(siblings.length + 1).padStart(2, '0');
      setCode(`${selectedParent.code}${nextSuffix}`);
    }
    setNameAr('');
    setNameEn('');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedName = nameAr.trim();
    if (!trimmedCode || !trimmedName) {
      setFormError('يرجى إدخال رمز الحساب والاسم العربي.');
      return;
    }
    if (accounts.some((a) => a.code === trimmedCode)) {
      setFormError('رمز الحساب موجود مسبقاً (قيد UNIQUE على عمود code).');
      return;
    }
    const parent = accounts.find((a) => a.id === parentId) ?? null;
    const accountType: AccountType = parent ? parent.accountType : 'asset';
    onAddAccount({
      code: trimmedCode,
      nameAr: trimmedName,
      nameEn: nameEn.trim() || trimmedName,
      accountType,
      normalBalance: DEFAULT_BALANCE_BY_TYPE[accountType],
      parentId: parent ? parent.id : null,
      level: parent ? parent.level + 1 : 1,
      isPostable,
      isActive: true,
      currentBalance: 0,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برمز أو اسم الحساب..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-60"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'asset', 'liability', 'equity', 'revenue', 'expense'] as const).map(
              (type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    typeFilter === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'all' ? 'الكل' : ACCOUNT_TYPE_LABELS[type]}
                </button>
              )
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حساب فرعي</span>
        </button>
      </div>

      {/* Hierarchical Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-40">رمز الحساب</th>
                <th className="py-3 px-4">اسم الحساب (الهيكل الهرمي)</th>
                <th className="py-3 px-4 w-32">التصنيف</th>
                <th className="py-3 px-4 w-28">الطبيعة</th>
                <th className="py-3 px-4 w-20 text-center">المستوى</th>
                <th className="py-3 px-4 w-36 text-left">الرصيد الحالي</th>
                <th className="py-3 px-4 w-36">قابلية الترحيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {orderedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    لا توجد حسابات مطابقة لبحثك الحالي.
                  </td>
                </tr>
              ) : (
                orderedRows.map((acc) => {
                  const hasChildren = 'hasChildren' in acc && Boolean((acc as { hasChildren?: boolean }).hasChildren);
                  const isCollapsed = collapsedIds.has(acc.id);
                  const indentPx = search || typeFilter !== 'all' ? 0 : (acc.level - 1) * 24;

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        acc.level === 1 ? 'bg-slate-50/50 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                        {acc.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingRight: `${indentPx}px` }}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(acc.id)}
                              aria-label={isCollapsed ? 'توسيع الفرع' : 'طي الفرع'}
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-500"
                            >
                              {isCollapsed ? (
                                <ChevronLeft className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-5 inline-block" />
                          )}
                          <span className="text-slate-900">{acc.nameAr}</span>
                          <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                            · {acc.nameEn}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700">
                        {ACCOUNT_TYPE_LABELS[acc.accountType]}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        {acc.normalBalance === 'debit' ? 'مدين (Debit)' : 'دائن (Credit)'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-center font-mono tabular-nums text-slate-600">
                        L{acc.level}
                      </td>
                      <td
                        className={`py-2.5 px-4 text-left font-mono text-xs tabular-nums ${
                          acc.level === 1
                            ? 'font-bold text-slate-900'
                            : acc.currentBalance !== 0
                            ? 'font-semibold text-emerald-700'
                            : 'text-slate-400'
                        }`}
                        dir="ltr"
                      >
                        {acc.currentBalance.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {acc.isPostable ? (
                          <span className="text-emerald-700 font-medium">حساب فرعي (يقبل قيود)</span>
                        ) : (
                          <span className="text-slate-500">حساب رئيسي تجميعي</span>
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

      {/* Add Sub-Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                إضافة حساب جديد في شجرة الحسابات
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

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  الحساب الأب (parent_id FK)
                </label>
                <select
                  value={parentId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setParentId(nextId);
                    const p = accounts.find((a) => a.id === nextId);
                    if (p) {
                      const siblings = accounts.filter((a) => a.parentId === p.id);
                      setCode(`${p.code}${String(siblings.length + 1).padStart(2, '0')}`);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                >
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.nameAr} ({ACCOUNT_TYPE_LABELS[p.accountType]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رمز الحساب (code)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    placeholder="110304"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم الإنجليزي (name_en)
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    placeholder="Dammam Warehouse Inventory"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  اسم الحساب بالعربية (name_ar)
                </label>
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  placeholder="مثال: مخزون فرع الدمام"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPostable}
                  onChange={(e) => setIsPostable(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>حساب فرعي يقبل تسجيل القيود المحاسبية (is_postable = TRUE)</span>
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
                  حفظ الحساب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
