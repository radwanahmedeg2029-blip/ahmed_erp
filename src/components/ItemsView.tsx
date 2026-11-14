import { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { ChartAccount, Item, ItemType, Unit, Warehouse } from '../types/erp';

interface ItemsViewProps {
  items: Item[];
  units: Unit[];
  warehouses: Warehouse[];
  accounts: ChartAccount[];
  onAddItem: (item: Omit<Item, 'id'>) => void;
}

function BarcodeGraphic({ value }: { value: string }) {
  // Deterministic lightweight barcode bars derived from characters
  const bars = value.split('').map((ch, idx) => {
    const code = ch.charCodeAt(0);
    const width = (code % 3) + 1;
    const gap = ((code + idx) % 2) + 1;
    return { width, gap };
  });

  return (
    <div className="inline-flex flex-col items-start gap-1" dir="ltr">
      <div className="flex items-stretch h-5" aria-hidden="true">
        {bars.map((b, i) => (
          <span
            key={i}
            className="bg-slate-800 inline-block"
            style={{ width: `${b.width}px`, marginRight: `${b.gap}px` }}
          />
        ))}
      </div>
      <span className="font-mono text-[11px] text-slate-600 tabular-nums">{value}</span>
    </div>
  );
}

export function ItemsView({
  items,
  units,
  warehouses,
  accounts,
  onAddItem,
}: ItemsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);

  const inventoryAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'asset' && a.isPostable),
    [accounts]
  );
  const cogsAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'expense' && a.isPostable),
    [accounts]
  );
  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.accountType === 'revenue' && a.isPostable),
    [accounts]
  );

  // Add item form state
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [itemType, setItemType] = useState<ItemType>('stock');
  const [baseUnitId, setBaseUnitId] = useState(units[0]?.id ?? '');
  const [purchaseUnitId, setPurchaseUnitId] = useState(units[0]?.id ?? '');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? ''
  );
  const [costPrice, setCostPrice] = useState('45.00');
  const [sellingPrice, setSellingPrice] = useState('75.00');
  const [minStockLevel, setMinStockLevel] = useState('10');
  const [inventoryAccountId, setInventoryAccountId] = useState(
    inventoryAccounts[0]?.id ?? ''
  );
  const [cogsAccountId, setCogsAccountId] = useState(cogsAccounts[0]?.id ?? '');
  const [revenueAccountId, setRevenueAccountId] = useState(
    revenueAccounts[0]?.id ?? ''
  );
  const [formError, setFormError] = useState('');

  const filtered = items.filter((item) => {
    const matchesType = typeFilter === 'all' || item.itemType === typeFilter;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.sku.toLowerCase().includes(q) ||
      item.barcode.toLowerCase().includes(q) ||
      item.nameAr.toLowerCase().includes(q) ||
      item.nameEn.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  const handleOpenModal = () => {
    const nextNum = items.length + 1;
    setSku(`ITM-${String(nextNum).padStart(4, '0')}`);
    setBarcode(`628100450${String(1000 + nextNum)}`);
    setNameAr('');
    setNameEn('');
    setItemType('stock');
    setBaseUnitId(units[0]?.id ?? '');
    setPurchaseUnitId(units[1]?.id ?? units[0]?.id ?? '');
    setDefaultWarehouseId(
      warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? ''
    );
    setCostPrice('45.00');
    setSellingPrice('75.00');
    setMinStockLevel('10');
    setInventoryAccountId(inventoryAccounts[0]?.id ?? '');
    setCogsAccountId(cogsAccounts[0]?.id ?? '');
    setRevenueAccountId(revenueAccounts[0]?.id ?? '');
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = Number(costPrice);
    const sell = Number(sellingPrice);
    const minLvl = Number(minStockLevel);

    if (!sku.trim() || !nameAr.trim() || !baseUnitId) {
      setFormError('يرجى إدخال رمز SKU واسم الصنف والوحدة الأساسية.');
      return;
    }
    if (items.some((i) => i.sku.toLowerCase() === sku.trim().toLowerCase())) {
      setFormError('رمز SKU مستخدم مسبقاً (قيد UNIQUE على عمود sku).');
      return;
    }
    if (barcode.trim() && items.some((i) => i.barcode === barcode.trim())) {
      setFormError('الباركود مسجل لصنف آخر مسبقاً (قيد UNIQUE على عمود barcode).');
      return;
    }
    if (Number.isNaN(cost) || cost < 0 || Number.isNaN(sell) || sell < 0) {
      setFormError('التكلفة وسعر البيع يجب أن تكون قيماً غير سالبة.');
      return;
    }

    onAddItem({
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim() || '—',
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || nameAr.trim(),
      itemType,
      baseUnitId,
      purchaseUnitId: purchaseUnitId || baseUnitId,
      defaultWarehouseId: itemType === 'service' ? null : defaultWarehouseId || null,
      costPrice: cost,
      sellingPrice: sell,
      minStockLevel: Number.isNaN(minLvl) ? 0 : minLvl,
      inventoryAccountId,
      cogsAccountId,
      revenueAccountId,
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
              placeholder="بحث بالاسم أو SKU أو الباركود..."
              className="pr-9 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 w-72 max-w-full"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'stock', label: 'أصناف مخزنية' },
                { id: 'service', label: 'خدمات' },
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

        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة صنف جديد</span>
        </button>
      </div>

      {/* Items Table */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 w-28">SKU</th>
                <th className="py-3 px-4">اسم الصنف</th>
                <th className="py-3 px-4 w-44">الباركود (Barcode)</th>
                <th className="py-3 px-4">الوحدات (أساسية / شراء)</th>
                <th className="py-3 px-4">المستودع الافتراضي</th>
                <th className="py-3 px-4 text-left w-28">التكلفة</th>
                <th className="py-3 px-4 text-left w-28">سعر البيع</th>
                <th className="py-3 px-4">الربط المحاسبي (GL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    لا توجد أصناف مطابقة لبحثك الحالي.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const baseUnit = units.find((u) => u.id === item.baseUnitId);
                  const purchaseUnit = units.find((u) => u.id === item.purchaseUnitId);
                  const warehouse = item.defaultWarehouseId
                    ? warehouses.find((w) => w.id === item.defaultWarehouseId)
                    : null;
                  const invAcc = accounts.find((a) => a.id === item.inventoryAccountId);
                  const cogsAcc = accounts.find((a) => a.id === item.cogsAccountId);
                  const revAcc = accounts.find((a) => a.id === item.revenueAccountId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {item.sku}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.nameAr}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {item.itemType === 'stock' ? 'صنف مخزني' : 'خدمة'} · {item.nameEn}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {item.barcode && item.barcode !== '—' ? (
                          <BarcodeGraphic value={item.barcode} />
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <div className="text-slate-900 font-medium">
                          {baseUnit?.nameAr ?? '—'}
                        </div>
                        {purchaseUnit && purchaseUnit.id !== baseUnit?.id && (
                          <div className="text-slate-500 mt-0.5">
                            شراء: {purchaseUnit.nameAr}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        {warehouse ? (
                          <div>
                            <span className="font-mono text-emerald-700 font-semibold">
                              {warehouse.code}
                            </span>
                            <div className="text-slate-600 mt-0.5">{warehouse.nameAr}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">غير مرتبط بمستودع</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-slate-900 tabular-nums" dir="ltr">
                        {item.costPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-left font-mono text-xs font-semibold text-emerald-700 tabular-nums" dir="ltr">
                        {item.sellingPrice.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono text-slate-600 tabular-nums">
                        <div>مخزون: {invAcc?.code ?? '—'}</div>
                        <div>تكلفة: {cogsAcc?.code ?? '—'} · إيراد: {revAcc?.code ?? '—'}</div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-base font-semibold text-slate-900">
                إضافة صنف جديد مع ربط المفاتيح الأجنبية
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
                    رمز الصنف (SKU)
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الباركود (barcode)
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    نوع الصنف
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItemType)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    <option value="stock">صنف مخزني (stock)</option>
                    <option value="service">خدمة (service)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    اسم الصنف بالعربية (name_ar)
                  </label>
                  <input
                    type="text"
                    value={nameAr}
                    onChange={(e) => setNameAr(e.target.value)}
                    placeholder="مثال: درج نقدية معدني 5 خانات"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
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
                    placeholder="Metal Cash Drawer 5-Slot"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    الوحدة الأساسية (base_unit_id FK)
                  </label>
                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    وحدة الشراء (purchase_unit_id FK)
                  </label>
                  <select
                    value={purchaseUnitId}
                    onChange={(e) => setPurchaseUnitId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.nameAr}
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
                    disabled={itemType === 'service'}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 disabled:bg-slate-100"
                  >
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
                    التكلفة بالوحدة الأساسية (cost_price)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    سعر البيع (selling_price)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حد إعادة الطلب (min_stock_level)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={minStockLevel}
                    onChange={(e) => setMinStockLevel(e.target.value)}
                    dir="ltr"
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب المخزون (FK)
                  </label>
                  <select
                    value={inventoryAccountId}
                    onChange={(e) => setInventoryAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {inventoryAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب تكلفة المبيعات (FK)
                  </label>
                  <select
                    value={cogsAccountId}
                    onChange={(e) => setCogsAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {cogsAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    حساب إيراد المبيعات (FK)
                  </label>
                  <select
                    value={revenueAccountId}
                    onChange={(e) => setRevenueAccountId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                  >
                    {revenueAccounts.map((a) => (
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
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
