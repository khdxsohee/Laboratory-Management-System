import React, { useMemo, useState } from 'react';
import { Search, Plus, Edit3, Trash2, X } from 'lucide-react';
import { LabSettings, LabTest, TestCategory, TestParameter } from '../types/lab';
import { formatMoney, generateId } from '../lib/storage';

interface CatalogViewProps {
  tests: LabTest[];
  settings: LabSettings;
  onSaveTest: (test: LabTest) => void;
  onDeleteTest: (testId: string) => void;
}

const CATEGORIES: ('All' | TestCategory)[] = [
  'All',
  'Hematology',
  'Biochemistry',
  'Lipid & Cardiac',
  'Endocrinology',
  'Urinalysis',
  'Microbiology',
  'Immunology',
];

const TEST_CATEGORIES: TestCategory[] = [
  'Hematology',
  'Biochemistry',
  'Lipid & Cardiac',
  'Endocrinology',
  'Urinalysis',
  'Microbiology',
  'Immunology',
];

export const CatalogView: React.FC<CatalogViewProps> = ({
  tests,
  settings,
  onSaveTest,
  onDeleteTest,
}) => {
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | TestCategory>('All');
  const [editingTest, setEditingTest] = useState<Partial<LabTest> | null>(null);
  const [editingParams, setEditingParams] = useState<TestParameter[]>([]);

  const filteredTests = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...tests]
      .filter((t) => {
        if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.sampleType.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [tests, query, categoryFilter]);

  const openCreateModal = () => {
    setEditingTest({
      code: `LAB-${String(tests.length + 101)}`,
      name: '',
      category: 'Biochemistry',
      sampleType: 'Serum (SST)',
      turnaroundHours: 4,
      price: 20,
      unit: 'mg/dL',
      minNormal: undefined,
      maxNormal: undefined,
      referenceText: '',
      active: true,
    });
    setEditingParams([]);
  };

  const openEditModal = (t: LabTest) => {
    setEditingTest({ ...t });
    setEditingParams(t.parameters.map((p) => ({ ...p })));
  };

  const addParameterRow = () => {
    setEditingParams((prev) => [
      ...prev,
      {
        id: generateId('param'),
        name: '',
        unit: '',
        minNormal: undefined,
        maxNormal: undefined,
        referenceText: '',
      },
    ]);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest?.name?.trim() || !editingTest?.code?.trim()) return;
    const cleanParams = editingParams.filter((p) => p.name.trim() !== '');
    const now = new Date().toISOString();

    const saved: LabTest = {
      id: editingTest.id || generateId('test'),
      code: editingTest.code.trim().toUpperCase(),
      name: editingTest.name.trim(),
      category: (editingTest.category as TestCategory) || 'Biochemistry',
      sampleType: (editingTest.sampleType || 'Serum').trim(),
      turnaroundHours: Math.max(1, Number(editingTest.turnaroundHours) || 4),
      price: Math.max(0, Number(editingTest.price) || 0),
      unit: cleanParams.length > 0 ? 'Panel' : (editingTest.unit || 'qual').trim(),
      minNormal:
        cleanParams.length > 0 || editingTest.minNormal === undefined || Number.isNaN(editingTest.minNormal)
          ? undefined
          : Number(editingTest.minNormal),
      maxNormal:
        cleanParams.length > 0 || editingTest.maxNormal === undefined || Number.isNaN(editingTest.maxNormal)
          ? undefined
          : Number(editingTest.maxNormal),
      referenceText:
        (editingTest.referenceText || '').trim() ||
        (cleanParams.length > 0 ? 'Multi-parameter diagnostic panel' : 'See reference interval'),
      parameters: cleanParams,
      active: editingTest.active ?? true,
      createdAt: editingTest.createdAt || now,
    };

    onSaveTest(saved);
    setEditingTest(null);
  };

  const toggleActive = (t: LabTest) => {
    onSaveTest({ ...t, active: !t.active });
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tests or codes..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Lab Test
          </button>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-3">Code</th>
                <th className="py-3 px-3">Investigation / Panel</th>
                <th className="py-3 px-3">Specimen & TAT</th>
                <th className="py-3 px-3">Reference Interval</th>
                <th className="py-3 px-3 text-right">Price</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 pl-3 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="py-3 pl-5 pr-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {t.code}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    <div className="text-[11px] text-slate-500">
                      {t.category}
                      {t.parameters.length > 0 ? ` · ${t.parameters.length} parameters` : ''}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                    {t.sampleType} · <span className="font-mono">{t.turnaroundHours}h</span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                    {t.referenceText}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold tabular-nums text-slate-900 whitespace-nowrap">
                    {formatMoney(t.price, settings.currencySymbol)}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className={`text-xs font-medium ${
                        t.active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {t.active ? '● Active' : '○ Disabled'}
                    </button>
                  </td>
                  <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(t)}
                        aria-label={`Edit ${t.name}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTest(t.id)}
                        aria-label={`Delete ${t.name}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Test Modal */}
      {editingTest && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSaveForm}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editingTest.id ? 'Edit Diagnostic Test' : 'Add Diagnostic Test'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTest(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Test Code *</label>
                  <input
                    type="text"
                    required
                    value={editingTest.code || ''}
                    onChange={(e) => setEditingTest({ ...editingTest, code: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-medium text-slate-700">Test / Panel Name *</label>
                  <input
                    type="text"
                    required
                    value={editingTest.name || ''}
                    onChange={(e) => setEditingTest({ ...editingTest, name: e.target.value })}
                    placeholder="e.g. Serum Calcium"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-medium text-slate-700">Category</label>
                  <select
                    value={editingTest.category || 'Biochemistry'}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, category: e.target.value as TestCategory })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    {TEST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Price ({settings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    required
                    value={editingTest.price ?? 0}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, price: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">TAT (Hours)</label>
                  <input
                    type="number"
                    min={1}
                    value={editingTest.turnaroundHours ?? 4}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, turnaroundHours: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Sample / Specimen Type</label>
                  <input
                    type="text"
                    value={editingTest.sampleType || ''}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, sampleType: e.target.value })
                    }
                    placeholder="e.g. Serum (SST)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">
                    Reference Interval Text
                  </label>
                  <input
                    type="text"
                    value={editingTest.referenceText || ''}
                    onChange={(e) =>
                      setEditingTest({ ...editingTest, referenceText: e.target.value })
                    }
                    placeholder="e.g. 8.5 - 10.2 mg/dL"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {editingParams.length === 0 && (
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">Unit</label>
                    <input
                      type="text"
                      value={editingTest.unit || ''}
                      onChange={(e) => setEditingTest({ ...editingTest, unit: e.target.value })}
                      placeholder="mg/dL or qual"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">Min Normal</label>
                    <input
                      type="number"
                      step="any"
                      value={editingTest.minNormal ?? ''}
                      onChange={(e) =>
                        setEditingTest({
                          ...editingTest,
                          minNormal: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-slate-700">Max Normal</label>
                    <input
                      type="number"
                      step="any"
                      value={editingTest.maxNormal ?? ''}
                      onChange={(e) =>
                        setEditingTest({
                          ...editingTest,
                          maxNormal: e.target.value === '' ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="Optional"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Multi-Parameter Panel Builder */}
              <div className="border-t border-slate-200 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="font-display text-sm font-semibold text-slate-900">
                      Panel Sub-Parameters (Optional)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Add sub-parameters if this test is a multi-analyte panel (e.g. CBC, LFT, Lipid).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addParameterRow}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Parameter
                  </button>
                </div>

                {editingParams.length > 0 && (
                  <div className="space-y-2">
                    {editingParams.map((param, idx) => (
                      <div
                        key={param.id}
                        className="grid grid-cols-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
                      >
                        <input
                          type="text"
                          placeholder="Parameter name"
                          value={param.name}
                          onChange={(e) => {
                            const next = [...editingParams];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setEditingParams(next);
                          }}
                          className="col-span-4 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={param.unit}
                          onChange={(e) => {
                            const next = [...editingParams];
                            next[idx] = { ...next[idx], unit: e.target.value };
                            setEditingParams(next);
                          }}
                          className="col-span-2 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder="Min"
                          value={param.minNormal ?? ''}
                          onChange={(e) => {
                            const next = [...editingParams];
                            next[idx] = {
                              ...next[idx],
                              minNormal: e.target.value === '' ? undefined : Number(e.target.value),
                            };
                            setEditingParams(next);
                          }}
                          className="col-span-2 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                        <input
                          type="number"
                          step="any"
                          placeholder="Max"
                          value={param.maxNormal ?? ''}
                          onChange={(e) => {
                            const next = [...editingParams];
                            next[idx] = {
                              ...next[idx],
                              maxNormal: e.target.value === '' ? undefined : Number(e.target.value),
                            };
                            setEditingParams(next);
                          }}
                          className="col-span-2 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Ref text"
                          value={param.referenceText}
                          onChange={(e) => {
                            const next = [...editingParams];
                            next[idx] = { ...next[idx], referenceText: e.target.value };
                            setEditingParams(next);
                          }}
                          className="col-span-1 rounded border border-slate-300 bg-white px-1.5 py-1 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditingParams((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="col-span-1 flex justify-center text-slate-400 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => setEditingTest(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Save Test to Catalog
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
