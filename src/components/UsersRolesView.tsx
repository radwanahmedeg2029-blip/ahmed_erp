import { useState } from 'react';
import { Plus, ShieldCheck, X } from 'lucide-react';
import { ERP_MODULES } from '../data/initialErpData';
import {
  AppUser,
  Employee,
  ErpModuleKey,
  Role,
  RolePermission,
  Warehouse,
} from '../types/erp';

interface UsersRolesViewProps {
  roles: Role[];
  permissions: RolePermission[];
  users: AppUser[];
  employees: Employee[];
  warehouses: Warehouse[];
  onTogglePermission: (
    roleId: string,
    moduleKey: ErpModuleKey,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete' | 'canApprove'
  ) => void;
  onAddRole: (role: Omit<Role, 'id'>) => void;
  onAddUser: (user: Omit<AppUser, 'id'>) => void;
  onToggleUserActive: (userId: string) => void;
}

export function UsersRolesView({
  roles,
  permissions,
  users,
  employees,
  warehouses,
  onTogglePermission,
  onAddRole,
  onAddUser,
  onToggleUserActive,
}: UsersRolesViewProps) {
  const [subTab, setSubTab] = useState<'permissions' | 'users'>('permissions');
  const [selectedRoleId, setSelectedRoleId] = useState<string>(roles[1]?.id ?? roles[0]?.id ?? '');

  // Modals
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleCode, setRoleCode] = useState('');
  const [roleNameAr, setRoleNameAr] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleError, setRoleError] = useState('');

  const [showUserModal, setShowUserModal] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userRoleId, setUserRoleId] = useState(roles[0]?.id ?? '');
  const [employeeId, setEmployeeId] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState(warehouses[0]?.id ?? '');
  const [userError, setUserError] = useState('');

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  const handleOpenRoleModal = () => {
    setRoleCode('');
    setRoleNameAr('');
    setRoleDesc('');
    setRoleError('');
    setShowRoleModal(true);
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleCode.trim() || !roleNameAr.trim()) {
      setRoleError('يرجى إدخال رمز الدور واسمه بالعربية.');
      return;
    }
    if (roles.some((r) => r.code.toLowerCase() === roleCode.trim().toLowerCase())) {
      setRoleError('رمز الدور مستخدم مسبقاً.');
      return;
    }
    onAddRole({
      code: roleCode.trim().toLowerCase(),
      nameAr: roleNameAr.trim(),
      nameEn: roleCode.trim(),
      description: roleDesc.trim() || 'دور وظيفي مخصص',
      isSystemRole: false,
    });
    setShowRoleModal(false);
  };

  const handleOpenUserModal = () => {
    setUsername('');
    setFullName('');
    setEmail('');
    setUserRoleId(roles[1]?.id ?? roles[0]?.id ?? '');
    setEmployeeId('');
    setDefaultWarehouseId(warehouses[0]?.id ?? '');
    setUserError('');
    setShowUserModal(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim() || !email.trim() || !userRoleId) {
      setUserError('يرجى تعبئة اسم المستخدم والاسم الكامل والبريد الإلكتروني والدور.');
      return;
    }
    if (
      users.some(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() ||
          u.email.toLowerCase() === email.trim().toLowerCase()
      )
    ) {
      setUserError('اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً.');
      return;
    }

    onAddUser({
      username: username.trim().toLowerCase(),
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      roleId: userRoleId,
      employeeId: employeeId || null,
      defaultWarehouseId: defaultWarehouseId || null,
      isActive: true,
      lastLoginAt: null,
    });
    setShowUserModal(false);
  };

  return (
    <div className="space-y-4">
      {/* Sub-Navigation & Action Bar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('permissions')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'permissions'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الأدوار ومصفوفة الصلاحيات ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('users')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'users'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مستخدمو النظام ({users.length})
          </button>
        </div>

        {subTab === 'permissions' ? (
          <button
            type="button"
            onClick={handleOpenRoleModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة دور وظيفي</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenUserModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مستخدم جديد</span>
          </button>
        )}
      </div>

      {/* Permissions Matrix View */}
      {subTab === 'permissions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden self-start">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              الأدوار الوظيفية (roles)
            </div>
            <div className="divide-y divide-slate-100">
              {roles.map((role) => {
                const active = role.id === selectedRole?.id;
                const userCount = users.filter((u) => u.roleId === role.id).length;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`w-full p-4 text-right transition-colors ${
                      active ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-semibold ${
                          active ? 'text-emerald-800' : 'text-slate-900'
                        }`}
                      >
                        {role.nameAr}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {userCount} مستخدم
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {role.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Permissions Grid */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-semibold text-slate-900">
                  صلاحيات دور: {selectedRole?.nameAr}
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-500" dir="ltr">
                role_permissions ({selectedRole?.code})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">الموديول (module_key)</th>
                    <th className="py-3 px-3 text-center w-20">عرض</th>
                    <th className="py-3 px-3 text-center w-20">إنشاء</th>
                    <th className="py-3 px-3 text-center w-20">تعديل</th>
                    <th className="py-3 px-3 text-center w-20">حذف</th>
                    <th className="py-3 px-3 text-center w-20">اعتماد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {ERP_MODULES.map((mod) => {
                    const perm = permissions.find(
                      (p) => p.roleId === selectedRole?.id && p.moduleKey === mod.key
                    );
                    const fields = [
                      'canView',
                      'canCreate',
                      'canEdit',
                      'canDelete',
                      'canApprove',
                    ] as const;

                    return (
                      <tr key={mod.key} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-xs font-semibold text-slate-900">
                            {mod.labelAr}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400" dir="ltr">
                            {mod.key}
                          </div>
                        </td>
                        {fields.map((field) => (
                          <td key={field} className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={perm ? perm[field] : false}
                              disabled={selectedRole?.isSystemRole}
                              onChange={() =>
                                selectedRole &&
                                onTogglePermission(selectedRole.id, mod.key, field)
                              }
                              aria-label={`${mod.labelAr} - ${field}`}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 disabled:opacity-60 cursor-pointer"
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Users Table View */}
      {subTab === 'users' && (
        <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">المستخدم</th>
                  <th className="py-3 px-4">الدور الوظيفي (role_id FK)</th>
                  <th className="py-3 px-4">الموظف المرتبط (employee_id FK)</th>
                  <th className="py-3 px-4">المستودع الافتراضي (FK)</th>
                  <th className="py-3 px-4">آخر تسجيل دخول</th>
                  <th className="py-3 px-4 w-28">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {users.map((user) => {
                  const role = roles.find((r) => r.id === user.roleId);
                  const emp = user.employeeId
                    ? employees.find((e) => e.id === user.employeeId)
                    : null;
                  const wh = user.defaultWarehouseId
                    ? warehouses.find((w) => w.id === user.defaultWarehouseId)
                    : null;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{user.fullName}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                          @{user.username} · {user.email}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-emerald-700">
                        {role?.nameAr ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {emp ? `${emp.employeeCode} · ${emp.fullNameAr}` : 'حساب إداري مستقل'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {wh ? `${wh.code} · ${wh.nameAr}` : 'جميع المستودعات'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 tabular-nums" dir="ltr">
                        {user.lastLoginAt ?? 'لم يسجل الدخول بعد'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <button
                          type="button"
                          onClick={() => onToggleUserActive(user.id)}
                          className={`font-semibold underline underline-offset-4 ${
                            user.isActive
                              ? 'text-emerald-700 hover:text-emerald-900'
                              : 'text-red-700 hover:text-red-900'
                          }`}
                        >
                          {user.isActive ? 'نشط' : 'موقوف'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-md overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة دور وظيفي جديد</h3>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleRoleSubmit} className="p-6 space-y-4">
              {roleError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {roleError}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  رمز الدور (code)
                </label>
                <input
                  type="text"
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value)}
                  dir="ltr"
                  placeholder="hr_officer"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  اسم الدور بالعربية
                </label>
                <input
                  type="text"
                  value={roleNameAr}
                  onChange={(e) => setRoleNameAr(e.target.value)}
                  placeholder="أخصائي الموارد البشرية"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  الوصف
                </label>
                <input
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  إنشاء الدور
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة مستخدم جديد</h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              {userError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {userError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    اسم المستخدم (username)
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    dir="ltr"
                    placeholder="a.alharbi"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    dir="ltr"
                    placeholder="a.alharbi@mizan-erp.sa"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الدور الوظيفي (role_id FK)
                  </label>
                  <select
                    value={userRoleId}
                    onChange={(e) => setUserRoleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الموظف المرتبط (FK)
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">بدون ربط موظف</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.employeeCode} — {emp.fullNameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    المستودع الافتراضي (FK)
                  </label>
                  <select
                    value={defaultWarehouseId}
                    onChange={(e) => setDefaultWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">الكل</option>
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
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  حفظ المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
