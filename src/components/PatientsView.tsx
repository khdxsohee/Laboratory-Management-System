import React, { useMemo, useState } from 'react';
import { Search, UserPlus, Edit3, Trash2, Plus, X, Printer, FileText } from 'lucide-react';
import { Gender, LabOrder, LabSettings, Patient } from '../types/lab';
import { formatMoney, formatShortDate, generateId, generateNextMrn } from '../lib/storage';

interface PatientsViewProps {
  patients: Patient[];
  orders: LabOrder[];
  settings: LabSettings;
  onSavePatient: (patient: Patient) => void;
  onDeletePatient: (patientId: string) => void;
  onNewOrderForPatient: (patientId: string) => void;
  onPrintOrder: (order: LabOrder, mode: 'receipt' | 'report') => void;
}

export const PatientsView: React.FC<PatientsViewProps> = ({
  patients,
  orders,
  settings,
  onSavePatient,
  onDeletePatient,
  onNewOrderForPatient,
  onPrintOrder,
}) => {
  const [query, setQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Partial<Patient> | null>(null);

  const patientStats = useMemo(() => {
    const map = new Map<string, { count: number; spent: number; due: number }>();
    for (const o of orders) {
      const curr = map.get(o.patientId) ?? { count: 0, spent: 0, due: 0 };
      curr.count += 1;
      curr.spent += o.totalAmount;
      curr.due += o.balanceDue;
      map.set(o.patientId, curr);
    }
    return map;
  }, [orders]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...patients]
      .filter((p) => {
        if (!q) return true;
        return (
          p.fullName.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.phone.toLowerCase().includes(q) ||
          p.referringDoctor.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [patients, query]);

  const selectedPatientOrders = useMemo(() => {
    if (!selectedPatient) return [];
    return orders
      .filter((o) => o.patientId === selectedPatient.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, selectedPatient]);

  const openCreateModal = () => {
    setEditingPatient({
      fullName: '',
      age: 30,
      gender: 'Male',
      phone: '',
      email: '',
      bloodGroup: '',
      address: '',
      referringDoctor: '',
      notes: '',
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient?.fullName?.trim() || !editingPatient?.phone?.trim()) return;
    const now = new Date().toISOString();

    const saved: Patient = editingPatient.id
      ? {
          ...(editingPatient as Patient),
          fullName: editingPatient.fullName.trim(),
          phone: editingPatient.phone.trim(),
          updatedAt: now,
        }
      : {
          id: generateId('pat'),
          mrn: generateNextMrn(patients),
          fullName: editingPatient.fullName.trim(),
          age: Math.max(0, Number(editingPatient.age) || 0),
          gender: (editingPatient.gender as Gender) || 'Male',
          phone: editingPatient.phone.trim(),
          email: (editingPatient.email || '').trim(),
          bloodGroup: (editingPatient.bloodGroup || '').trim(),
          address: (editingPatient.address || '').trim(),
          referringDoctor: (editingPatient.referringDoctor || '').trim(),
          notes: (editingPatient.notes || '').trim(),
          createdAt: now,
          updatedAt: now,
        };

    onSavePatient(saved);
    if (selectedPatient && selectedPatient.id === saved.id) {
      setSelectedPatient(saved);
    }
    setEditingPatient(null);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="relative min-w-[260px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients by name, MRN, phone, or doctor..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Register Patient
        </button>
      </div>

      {/* Main Split: Patient Table + Detail Profile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${
            selectedPatient ? 'lg:col-span-7' : 'lg:col-span-12'
          }`}
        >
          {filteredPatients.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-slate-700">No patients found</p>
              <p className="mt-1 text-xs text-slate-500">
                Register a patient to begin tracking orders and diagnostic history.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 pl-5 pr-3">MRN</th>
                    <th className="py-3 px-3">Patient</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3 text-right">Orders</th>
                    <th className="py-3 px-3 text-right">Total Billed</th>
                    <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((p) => {
                    const stats = patientStats.get(p.id) ?? { count: 0, spent: 0, due: 0 };
                    const isSelected = selectedPatient?.id === p.id;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 pl-5 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {p.mrn}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{p.fullName}</div>
                          <div className="text-[11px] text-slate-500">
                            {p.age} yrs · {p.gender}
                            {p.bloodGroup ? ` · ${p.bloodGroup}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-mono text-slate-800">{p.phone}</div>
                          {p.referringDoctor && (
                            <div className="text-[11px] text-slate-500">Ref: {p.referringDoctor}</div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                          {stats.count}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">
                          <div className="font-semibold text-slate-900">
                            {formatMoney(stats.spent, settings.currencySymbol)}
                          </div>
                          {stats.due > 0 && (
                            <div className="text-[11px] font-semibold text-red-700">
                              Due {formatMoney(stats.due, settings.currencySymbol)}
                            </div>
                          )}
                        </td>
                        <td
                          className="py-3 pl-3 pr-5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onNewOrderForPatient(p.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              <Plus className="h-3 w-3 text-blue-700" />
                              Order
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPatient(p)}
                              aria-label={`Edit ${p.fullName}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Patient Profile Panel */}
        {selectedPatient && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-5 self-start">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="font-mono text-xs font-semibold text-blue-700">
                  {selectedPatient.mrn}
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {selectedPatient.fullName}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedPatient.age} Years · {selectedPatient.gender}
                  {selectedPatient.bloodGroup ? ` · Blood ${selectedPatient.bloodGroup}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                aria-label="Close patient panel"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-slate-400">Phone</div>
                <div className="font-mono text-slate-900">{selectedPatient.phone}</div>
              </div>
              <div>
                <div className="text-slate-400">Referring Physician</div>
                <div className="text-slate-900">{selectedPatient.referringDoctor || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400">Email</div>
                <div className="truncate text-slate-900">{selectedPatient.email || '—'}</div>
              </div>
              <div>
                <div className="text-slate-400">Registered</div>
                <div className="font-mono text-slate-900">
                  {formatShortDate(selectedPatient.createdAt)}
                </div>
              </div>
              {selectedPatient.address && (
                <div className="col-span-2">
                  <div className="text-slate-400">Address</div>
                  <div className="text-slate-900">{selectedPatient.address}</div>
                </div>
              )}
              {selectedPatient.notes && (
                <div className="col-span-2">
                  <div className="text-slate-400">Clinical Notes</div>
                  <div className="text-slate-700">{selectedPatient.notes}</div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-y border-slate-200 py-3">
              <button
                type="button"
                onClick={() => onNewOrderForPatient(selectedPatient.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-3.5 w-3.5" />
                New Lab Order
              </button>
              <button
                type="button"
                onClick={() => setEditingPatient(selectedPatient)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeletePatient(selectedPatient.id);
                  setSelectedPatient(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>

            <div>
              <h4 className="mb-2.5 font-display text-xs font-semibold uppercase tracking-wider text-slate-500">
                Diagnostic Visit History ({selectedPatientOrders.length})
              </h4>
              {selectedPatientOrders.length === 0 ? (
                <p className="text-xs text-slate-500">No lab orders placed for this patient yet.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {selectedPatientOrders.map((ord) => (
                    <div key={ord.id} className="py-2.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-900">
                          {ord.orderNumber}
                        </span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {formatShortDate(ord.createdAt)} ·{' '}
                          <strong className="text-slate-900">
                            {formatMoney(ord.totalAmount, settings.currencySymbol)}
                          </strong>
                        </span>
                      </div>
                      <div className="text-slate-600">
                        {ord.items.map((i) => i.testName).join(', ')}
                      </div>
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] font-medium text-slate-500">
                          {ord.status} · {ord.paymentStatus}
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => onPrintOrder(ord, 'receipt')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            <Printer className="h-3 w-3" />
                            Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintOrder(ord, 'report')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                          >
                            <FileText className="h-3 w-3" />
                            Report
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Patient Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleFormSubmit}
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editingPatient.id ? 'Edit Patient Profile' : 'Register New Patient'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPatient(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={editingPatient.fullName || ''}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, fullName: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Age *</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  required
                  value={editingPatient.age ?? 30}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, age: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Gender *</label>
                <select
                  value={editingPatient.gender || 'Male'}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, gender: e.target.value as Gender })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={editingPatient.phone || ''}
                  onChange={(e) => setEditingPatient({ ...editingPatient, phone: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Blood Group</label>
                <input
                  type="text"
                  placeholder="e.g. O+"
                  value={editingPatient.bloodGroup || ''}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, bloodGroup: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editingPatient.email || ''}
                  onChange={(e) => setEditingPatient({ ...editingPatient, email: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Referring Doctor</label>
                <input
                  type="text"
                  value={editingPatient.referringDoctor || ''}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, referringDoctor: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-slate-700">Address</label>
                <input
                  type="text"
                  value={editingPatient.address || ''}
                  onChange={(e) =>
                    setEditingPatient({ ...editingPatient, address: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-slate-700">Clinical Notes</label>
                <input
                  type="text"
                  value={editingPatient.notes || ''}
                  onChange={(e) => setEditingPatient({ ...editingPatient, notes: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setEditingPatient(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Save Patient
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
