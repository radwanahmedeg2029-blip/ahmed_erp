'use client';
import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Package, FileText, DollarSign, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    customersCount: 0,
    suppliersCount: 0,
    itemsCount: 0,
    warehousesCount: 0
  });

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 flex font-sans">
      {/* القائمة الجانبية */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-slate-800 text-emerald-400">
          آل رضوان للحسابات
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 bg-emerald-600 rounded-lg text-white font-medium">
            <LayoutDashboard size={20} /> لوحة التحكم
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg">
            <Users size={20} /> العملاء والموردين
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg">
            <Package size={20} /> المخازن والأصناف
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-300 hover:bg-slate-800 rounded-lg">
            <FileText size={20} /> الفواتير والسندات
          </a>
        </nav>
      </aside>

      {/* المحتوى الرئيسي */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">لوحة المؤشرات الرئيسية</h1>
          <span className="bg-emerald-100 text-emerald-800 text-sm font-semibold px-4 py-1.5 rounded-full">
            متصل بالسحابة 🟢
          </span>
        </header>

        {/* بطاقات الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">إجمالي العملاء</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">0</h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Users size={24} /></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">إجمالي الموردين</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">0</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><Users size={24} /></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">الأصناف بالمخازن</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">0</h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><Package size={24} /></div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">حركة اليوم</p>
              <h3 className="text-2xl font-bold text-slate-800 mt-1">0.00</h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg"><DollarSign size={24} /></div>
          </div>
        </div>

        {/* رسالة ترحيبية */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">أهلاً بك في نظام آل رضوان للحسابات</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            قاعدة البيانات السحابية جاهزة ومؤتمتة بالكامل. يمكنك الآن البدء بإضافة الحركات والفواتير بكل سهولة.
          </p>
        </div>
      </main>
    </div>
  );
}
