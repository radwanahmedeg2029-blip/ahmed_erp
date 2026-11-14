import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ChartAccount, Employee, EmploymentStatus, Warehouse } from '../types/erp';

interface EmployeesViewProps {
  employees: Employee[];
  warehouses: Warehouse[];
  accounts: ChartAccount[];
  onAddEmployee: (emp: Omit<Employee, 'id'>) => void;
}

const STATUS_LABELS: Record<EmploymentStatus, { label: string; cls: string }> = {
  active: { label: 'على رأس العمل', cls: 'text-emerald-700' },
  on_leave: { label: 'في إجازة', cls: 'text-amber-700' },
  terminated: { label: 'منتهي الخدمة', cls: 'text-red-700' },
};

export function EmployeesView({
  employees,
  warehouses,
  accounts,
  onAddEmployee,
}: EmployeesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | 'all'>('all');
  const [showModal, setShowModal] = useState(false);

  const expenseAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'expense' && a.isPostable),
    [accounts]
  );
  const advanceAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'asset' && a.isPostable),
    [accounts]
  );

  const [employeeCode, setEmployeeCode] = useState('');
  const [fullNameAr, setFullNameAr] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [department, setDepartment] = useState('المستودعات واللوجستيات');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [basicSalary, setBasicSalary] = useState('6000');
  const [housingAllowance, setHousingAllowance] = useState('1500');
  const [transportAllowance, setTransportAllowance] = useState('600');
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [salaryExpenseAccountId, setSalaryExpenseAccountId] = useState(
    expenseAccounts.find((a) => a.code === '5202')?.id ?? expenseAccounts[0]?.id ?? ''
  );
  const [advanceAccountId, setAdvanceAccountId] = useState(
    advanceAccounts.find((a) => a.code === '1104')?.id ?? advanceAccounts[0]?.id ?? ''
  );
  const [formError, setFormError] = useState('');

  const filtered = employees.filter((emp) => {
    const matchesStatus =
      statusFilter === 'all' || emp.employmentStatus === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      emp.employeeCode.toLowerCase().includes(q) ||
      emp.fullNameAr.toLowerCase().includes(q) ||
      emp.department.toLowerCase().includes(q) ||
      emp.jobTitle.toLowerCase().includes(q) ||
      emp.nationalId.includes(q);
    return matchesStatus && matchesQuery;
  });

  const totalPayroll = useMemo(
    () =>
      employees
        .filter((e) => e.employmentStatus !== 'terminated')
        .reduce(
          (sum, e) => sum + e.basicSalary + e.housingAllowance + e.transportAllowance,
          0
        ),
    [employees]
  );

  const handleOpenModal = () => {
    setEmployeeCode(`EMP-${String(employees.length + 1).padStart(3, '0')}`);
    setFullNameAr('');
    setFullNameEn('');
    setNationalId('');
    setDepartment('المستودعات واللوجستيات');
    setJobTitle('');
    setPhone('');
    setBasicSalary('6000');
    setHousingAllowance('1500');
    setTransportAllowance('600');
    setWarehouseId(warehouses[0]?.id ?? '');
    setSalaryExpenseAccountId(
      expenseAccounts.find((a) => a.code === '5202')?.id ?? expenseAccounts[0]?.id ?? ''
    );
    setAdvanceAccountId(
      advanceAccounts.find((a) => a.code === '1104')?.id ?? advanceAccounts[0]?.id ?? ''
    );
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const basic = Number(basicSalary);
    const housing = Number(housingAllowance);
    const transport = Number(transportAllowance);

    if (!employeeCode.trim() || !fullNameAr.trim() || !jobTitle.trim()) {
      setFormError('يرجى إدخال الرقم الوظيفي والاسم الكامل والمسمى الوظيفي.');
      return;
    }
    if (
      employees.some(
        (emp) => emp.employeeCode.toLowerCase() === employeeCode.trim().toLowerCase()
      )
    ) {
      setFormError('الرقم الوظيفي مسجل مسبقاً.');
      return;
    }

    onAddEmployee({
      employeeCode: employeeCode.trim().toUpperCase(),
      fullNameAr: fullNameAr.trim(),
      fullNameEn: fullNameEn.trim() || fullNameAr.trim(),
      nationalId: nationalId.trim() || '—',
      department: department.trim(),
      jobTitle: jobTitle.trim(),
      hireDate: new Date().toISOString().slice(0, 10),
      phone: phone.trim() || '—',
      email: '—',
      basicSalary: Number.isNaN(basic) ? 0 : Math.max(0, basic),
      housingAllowance: Number.isNaN(housing) ? 0 : Math.max(0, housing),
      transportAllowance: Number.isNaN(transport) ? 0 : Math.max(0, transport),
      warehouseId: warehouseId || null,
      salaryExpenseAccountId,
      advanceAccountId,
      employmentStatus: 'active',
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
              placeholder="بحث بالاسم أو الرقم الوظيفي أو الهوية..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['all', 'active', 'on_leave', 'terminated'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'all' ? 'الكل' : STATUS_LABELS[st].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-600">
            إجمالي الرواتب الشهرية:{' '}
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {totalPayroll.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة موظف</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">الرقم الوظيفي</th>
                <th className="py-3 px-4">الموظف والهوية</th>
                <th className="py-3 px-4">القسم والمسمى</th>
                <th className="py-3 px-4">المستودع / الفرع (FK)</th>
                <th className="py-3 px-4 text-left">الراتب الأساسي</th>
                <th className="py-3 px-4 text-left">إجمالي الراتب</th>
                <th className="py-3 px-4">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    لا توجد سجلات موظفين مطابقة للبحث.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => {
                  const wh = emp.warehouseId
                    ? warehouses.find((w) => w.id === emp.warehouseId)
                    : null;
                  const totalSalary =
                    emp.basicSalary + emp.housingAllowance + emp.transportAllowance;
                  const statusMeta = STATUS_LABELS[emp.employmentStatus];

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {emp.employeeCode}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{emp.fullNameAr}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          هوية: {emp.nationalId} · تعيين: {emp.hireDate}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="font-medium text-slate-800">{emp.jobTitle}</div>
                        <div className="text-slate-500 mt-0.5">{emp.department}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {wh ? (
                          <span>
                            <span className="font-mono text-emerald-700 font-semibold">
                              {wh.code}
                            </span>{' '}
                            · {wh.nameAr}
                          </span>
                        ) : (
                          <span className="text-slate-400">الإدارة العامة</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs text-slate-700 tabular-nums" dir="ltr">
                        {emp.basicSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {totalSalary.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`py-3 px-4 text-xs font-semibold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">إضافة موظف جديد</h3>
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
                    الرقم الوظيفي
                  </label>
                  <input
                    type="text"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رقم الهوية / الإقامة
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    رقم الجوال
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم الكامل بالعربية
                  </label>
                  <input
                    type="text"
                    value={fullNameAr}
                    onChange={(e) => setFullNameAr(e.target.value)}
                    placeholder="أحمد عبد العزيز الحربي"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم الإنجليزي
                  </label>
                  <input
                    type="text"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    القسم
                  </label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المسمى الوظيفي
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="مراقب مخزون"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المستودع / الفرع (FK)
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">الإدارة العامة (بدون مستودع)</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} — {w.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الراتب الأساسي
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    بدل السكن
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    بدل النقل
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب مصروف الرواتب (FK)
                  </label>
                  <select
                    value={salaryExpenseAccountId}
                    onChange={(e) => setSalaryExpenseAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب سلف الموظفين (FK)
                  </label>
                  <select
                    value={advanceAccountId}
                    onChange={(e) => setAdvanceAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {advanceAccounts.map((a) => (
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  حفظ الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
