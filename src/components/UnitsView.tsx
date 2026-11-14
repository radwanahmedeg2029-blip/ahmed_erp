import { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, X } from 'lucide-react';
import { Unit } from '../types/erp';

interface UnitsViewProps {
  units: Unit[];
  onAddUnit: (unit: Omit<Unit, 'id'>) => void;
}

export function UnitsView({ units, onAddUnit }: UnitsViewProps) {
  const [showModal, setShowModal] = useState(false);

  // Live conversion calculator state
  const [qty, setQty] = useState<string>('5');
  const [fromUnitId, setFromUnitId] = useState<string>(units[2]?.id ?? units[0]?.id ?? '');
  const [toUnitId, setToUnitId] = useState<string>(units[0]?.id ?? '');

  // Add unit form state
  const [code, setCode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [symbol, setSymbol] = useState('');
  const [isBase, setIsBase] = useState(false);
  const [baseUnitId, setBaseUnitId] = useState<string>(units.find((u) => !u.baseUnitId)?.id ?? '');
  const [conversionFactor, setConversionFactor] = useState<string>('12');
  const [formError, setFormError] = useState('');

  const baseUnits = useMemo(() => units.filter((u) => u.baseUnitId === null), [units]);

  const conversionResult = useMemo(() => {
    const fromUnit = units.find((u) => u.id === fromUnitId);
    const toUnit = units.find((u) => u.id === toUnitId);
    const numericQty = Number(qty);
    if (!fromUnit || !toUnit || Number.isNaN(numericQty)) {
      return { valid: false, message: 'أدخل كمية صالحة' };
    }
    const fromRoot = fromUnit.baseUnitId ?? fromUnit.id;
    const toRoot = toUnit.baseUnitId ?? toUnit.id;
    if (fromRoot !== toRoot) {
      return {
        valid: false,
        message: 'لا يمكن التحويل بين وحدتين تنتميان لوحدتين أساسيتين مختلفتين (مثلاً: حبة وكيلوجرام).',
      };
    }
    const inBaseUnits = numericQty * fromUnit.conversionFactor;
    const converted = inBaseUnits / toUnit.conversionFactor;
    return {
      valid: true,
      value: converted,
      formula: `${numericQty} × ${fromUnit.conversionFactor} ÷ ${toUnit.conversionFactor}`,
      toSymbol: toUnit.symbol,
    };
  }, [units, fromUnitId, toUnitId, qty]);

  const handleOpenModal = () => {
    setCode('');
    setNameAr('');
    setNameEn('');
    setSymbol('');
    setIsBase(false);
    setBaseUnitId(baseUnits[0]?.id ?? '');
    setConversionFactor('12');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const factorNum = isBase ? 1 : Number(conversionFactor);
    if (!code.trim() || !nameAr.trim() || !symbol.trim()) {
      setFormError('يرجى إدخال رمز الوحدة والاسم والاختصار.');
      return;
    }
    if (units.some((u) => u.code.toLowerCase() === code.trim().toLowerCase())) {
      setFormError('رمز الوحدة موجود مسبقاً (قيد UNIQUE على عمود code).');
      return;
    }
    if (!isBase && (!baseUnitId || Number.isNaN(factorNum) || factorNum <= 0)) {
      setFormError('يجب تحديد الوحدة الأساسية ومعامل تحويل أكبر من صفر (CHECK conversion_factor > 0).');
      return;
    }

    onAddUnit({
      code: code.trim().toUpperCase(),
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      symbol: symbol.trim(),
      baseUnitId: isBase ? null : baseUnitId,
      conversionFactor: factorNum,
      isActive: true,
    });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Live Unit Conversion Tester */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              حاسبة التحويل المباشر بين الوحدات (Conversion Factor Test)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تتحقق الحاسبة من مطابقة الوحدة الأساسية المرجعية (base_unit_id) وتحسب الكمية بدقة 6 خانات عشرية.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة وحدة جديدة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 items-end">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">الكمية</label>
            <input
              type="number"
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">من وحدة</label>
            <select
              value={fromUnitId}
              onChange={(e) => setFromUnitId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nameAr} ({u.code})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1 flex justify-center pb-2">
            <ArrowLeftRight className="w-4 h-4 text-slate-400" />
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">إلى وحدة</label>
            <select
              value={toUnitId}
              onChange={(e) => setToUnitId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nameAr} ({u.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {conversionResult.valid ? (
            <>
              <div className="text-sm text-slate-900">
                النتيجة:{' '}
                <span className="font-mono font-bold text-emerald-700 tabular-nums">
                  {Number(conversionResult.value?.toFixed(6))}
                </span>{' '}
                <span className="font-semibold">{conversionResult.toSymbol}</span>
              </div>
              <div className="text-xs font-mono text-slate-500 tabular-nums" dir="ltr">
                {conversionResult.formula}
              </div>
            </>
          ) : (
            <div className="text-xs text-amber-700 font-medium">{conversionResult.message}</div>
          )}
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">الرمز</th>
                <th className="py-3 px-4">اسم الوحدة</th>
                <th className="py-3 px-4 w-24">الاختصار</th>
                <th className="py-3 px-4">الوحدة الأساسية المرجعية (FK)</th>
                <th className="py-3 px-4 w-44 text-left">معامل التحويل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {units.map((unit) => {
                const baseUnit = unit.baseUnitId
                  ? units.find((u) => u.id === unit.baseUnitId)
                  : null;
                return (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                      {unit.code}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-900">{unit.nameAr}</span>
                      <span className="text-xs text-slate-400 mr-2">· {unit.nameEn}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">{unit.symbol}</td>
                    <td className="py-3 px-4 text-xs">
                      {baseUnit ? (
                        <span className="text-slate-800">
                          <span className="font-mono text-emerald-700 font-semibold">
                            {baseUnit.code}
                          </span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <span>{baseUnit.nameAr}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">وحدة أساسية مستقلة (NULL)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                      {unit.conversionFactor.toFixed(6).replace(/\.?0+$/, (m) => (m === '.000000' ? '' : m))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Unit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-lg overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">إضافة وحدة قياس جديدة</h3>
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
                    رمز الوحدة (code)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    dir="ltr"
                    placeholder="BOX-6"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاختصار (symbol)
                  </label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    placeholder="عبوة"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم بالعربية (name_ar)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="عبوة (6 حبات)"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الاسم بالإنجليزية
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    dir="ltr"
                    placeholder="Pack of 6"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBase}
                  onChange={(e) => setIsBase(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>وحدة أساسية مستقلة (base_unit_id = NULL، معامل التحويل = 1)</span>
              </label>

              {!isBase && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      الوحدة الأساسية المرجعية (base_unit_id FK)
                    </label>
                    <select
                      value={baseUnitId}
                      onChange={(e) => setBaseUnitId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    >
                      {baseUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.code} — {u.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      معامل التحويل (conversion_factor)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.000001"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      dir="ltr"
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              )}

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
                  حفظ الوحدة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
