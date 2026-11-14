import { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import { FULL_SQL_SCRIPT, SQL_SECTIONS } from '../data/sqlSchema';

export function SqlSchemaView() {
  const [selectedFilter, setSelectedFilter] = useState<string>('phase5');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleSections =
    selectedFilter === 'all'
      ? SQL_SECTIONS
      : selectedFilter === 'phase1'
      ? SQL_SECTIONS.filter((s) => s.phase === 1)
      : selectedFilter === 'phase2'
      ? SQL_SECTIONS.filter((s) => s.phase === 2)
      : selectedFilter === 'phase3'
      ? SQL_SECTIONS.filter((s) => s.phase === 3)
      : selectedFilter === 'phase4'
      ? SQL_SECTIONS.filter((s) => s.phase === 4)
      : selectedFilter === 'phase5'
      ? SQL_SECTIONS.filter((s) => s.phase === 5)
      : SQL_SECTIONS.filter((s) => s.id === selectedFilter);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([FULL_SQL_SCRIPT], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mizan_erp_full_supabase_schema.sql';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Filter Toolbar */}
      <div className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setSelectedFilter('phase5')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'phase5'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المرحلة 5: التقارير الختامية ({SQL_SECTIONS.filter((s) => s.phase === 5).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('phase4')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'phase4'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المرحلة 4: الفواتير والمخازن ({SQL_SECTIONS.filter((s) => s.phase === 4).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('phase3')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'phase3'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المرحلة 3: السندات والقيود ({SQL_SECTIONS.filter((s) => s.phase === 3).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('phase2')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'phase2'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المرحلة 2: الأطراف والموارد البشرية ({SQL_SECTIONS.filter((s) => s.phase === 2).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('phase1')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'phase1'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              المرحلة 1: الحسابات والمخازن ({SQL_SECTIONS.filter((s) => s.phase === 1).length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              السكربت الكامل ({SQL_SECTIONS.length})
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  visibleSections.map((s) => s.code).join('\n\n'),
                  'filtered'
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {copiedId === 'filtered' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>تم نسخ المعروض</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>نسخ الأقسام المعروضة</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadSql}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>تحميل السكربت الكامل .sql</span>
            </button>
          </div>
        </div>

        {/* Individual Table Jump Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className="text-[11px] text-slate-500 ml-1">انتقال سريع لقسم:</span>
          {SQL_SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => setSelectedFilter(sec.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors whitespace-nowrap ${
                selectedFilter === sec.id
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {sec.shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-6">
        {visibleSections.map((section) => {
          const lines = section.code.split('\n');
          return (
            <section
              key={section.id}
              className="bg-white border border-slate-200/90 shadow-2xs rounded-2xl overflow-hidden"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-b border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    المرحلة {section.phase} · PostgreSQL / Supabase
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {section.titleAr}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{section.subtitleAr}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(section.code, section.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                >
                  {copiedId === section.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ القسم</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12">
                {/* Code Block */}
                <div className="xl:col-span-8 bg-slate-950 text-slate-100 p-4 overflow-x-auto" dir="ltr">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400 font-mono">
                    <span className="inline-flex items-center gap-1.5">
                      <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
                      PostgreSQL / Supabase SQL Editor
                    </span>
                    <span className="tabular-nums">{lines.length} lines</span>
                  </div>
                  <pre className="text-xs leading-6 font-mono text-slate-100">
                    {lines.map((line, index) => (
                      <div key={index} className="flex">
                        <span className="select-none w-9 shrink-0 text-right pr-3 text-slate-600 tabular-nums">
                          {index + 1}
                        </span>
                        <code
                          className={
                            line.trim().startsWith('--')
                              ? 'text-slate-400'
                              : line.includes('CREATE TABLE') ||
                                line.includes('CREATE TYPE') ||
                                line.includes('REFERENCES') ||
                                line.includes('ALTER TABLE')
                              ? 'text-sky-300'
                              : 'text-slate-100'
                          }
                        >
                          {line || ' '}
                        </code>
                      </div>
                    ))}
                  </pre>
                </div>

                {/* Simplified Arabic Explanation */}
                <div className="xl:col-span-4 p-6 bg-slate-50/70 border-t xl:border-t-0 xl:border-r border-slate-200">
                  <h4 className="text-xs font-semibold text-slate-500 mb-4">
                    الشرح المبسط والقرارات الهندسية
                  </h4>
                  <ul className="divide-y divide-slate-200">
                    {section.explanationPoints.map((pt, i) => (
                      <li key={i} className="py-3 first:pt-0 last:pb-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {pt.label}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed mt-1">
                          {pt.detail}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
