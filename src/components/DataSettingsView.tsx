import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  HardDrive,
  FileSpreadsheet,
  Check,
  RotateCcw,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { LabBackupFile, LabDatabaseState, LabSettings } from '../types/lab';
import {
  exportFullBackupJson,
  exportOrdersCsv,
  exportPatientsCsv,
  exportTestsCsv,
  formatDateTime,
  parseAndValidateBackupJson,
} from '../lib/storage';

interface DataSettingsViewProps {
  dbState: LabDatabaseState;
  storagePersisted: boolean;
  onUpdateSettings: (settings: LabSettings) => void;
  onImportBackup: (backup: LabBackupFile, mode: 'merge' | 'replace') => void;
  onResetToSeed: () => void;
  onClearAllRecords: () => void;
}

const CURRENCY_PRESETS = [
  { label: 'USD ($)', symbol: '$' },
  { label: 'PKR (Rs.)', symbol: 'Rs. ' },
  { label: 'INR (₹)', symbol: '₹' },
  { label: 'EUR (€)', symbol: '€' },
  { label: 'GBP (£)', symbol: '£' },
  { label: 'AED', symbol: 'AED ' },
  { label: 'SAR', symbol: 'SAR ' },
];

export const DataSettingsView: React.FC<DataSettingsViewProps> = ({
  dbState,
  storagePersisted,
  onUpdateSettings,
  onImportBackup,
  onResetToSeed,
  onClearAllRecords,
}) => {
  const [draft, setDraft] = useState<LabSettings>({ ...dbState.settings });
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingBackup, setPendingBackup] = useState<LabBackupFile | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<'seed' | 'clear' | null>(null);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(draft);
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 2500);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    setImportSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseAndValidateBackupJson(text);
      setPendingBackup(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Unable to parse backup file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executeImport = (mode: 'merge' | 'replace') => {
    if (!pendingBackup) return;
    onImportBackup(pendingBackup, mode);
    setImportSuccess(
      `Imported ${pendingBackup.data.patients.length} patients, ${pendingBackup.data.tests.length} tests, and ${pendingBackup.data.orders.length} orders (${mode === 'merge' ? 'Merged' : 'Replaced'}).`
    );
    setPendingBackup(null);
  };

  return (
    <div className="space-y-8">
      {/* Backup, Export & Import Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Local Backup Export & Import
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Download a complete JSON snapshot of your laboratory database or restore from a
                saved local file.
              </p>
            </div>
            <HardDrive className="h-5 w-5 text-blue-700 shrink-0" />
          </div>

          {/* Persistence Summary */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-4">
            <div>
              <div className="text-slate-500">Patients</div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                {dbState.patients.length}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Lab Tests</div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                {dbState.tests.length}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Orders</div>
              <div className="mt-0.5 font-mono text-lg font-bold tabular-nums text-slate-900">
                {dbState.orders.length}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Storage Engine</div>
              <div className="mt-1 font-mono text-[11px] font-semibold text-emerald-700">
                IndexedDB {storagePersisted ? '· Pinned' : '· Active'}
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Export Local Data
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => exportFullBackupJson(dbState)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Download className="h-4 w-4" />
                Download Full Backup (.JSON)
              </button>
              <button
                type="button"
                onClick={() => exportPatientsCsv(dbState.patients)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                Patients (.CSV)
              </button>
              <button
                type="button"
                onClick={() => exportOrdersCsv(dbState.orders)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                Orders & Billing (.CSV)
              </button>
              <button
                type="button"
                onClick={() => exportTestsCsv(dbState.tests)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                Test Catalog (.CSV)
              </button>
            </div>
          </div>

          {/* Import Action */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Restore / Import from Local File
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                id="backup-file-upload"
              />
              <label
                htmlFor="backup-file-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-900 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Upload className="h-4 w-4" />
                Select Backup File (.JSON)
              </label>
              <span className="text-xs text-slate-500">
                Last auto-saved: <span className="font-mono">{formatDateTime(dbState.lastUpdated)}</span>
              </span>
            </div>

            {importError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                {importError}
              </div>
            )}

            {importSuccess && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800">
                {importSuccess}
              </div>
            )}

            {pendingBackup && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 space-y-3 text-xs">
                <div className="font-semibold text-slate-900">
                  Backup File Ready to Import (Exported {formatDateTime(pendingBackup.exportedAt)})
                </div>
                <div className="font-mono text-slate-700">
                  Contains: {pendingBackup.data.patients.length} Patients ·{' '}
                  {pendingBackup.data.tests.length} Tests · {pendingBackup.data.orders.length}{' '}
                  Orders
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => executeImport('merge')}
                    className="rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Merge with Current Data
                  </button>
                  <button
                    type="button"
                    onClick={() => executeImport('replace')}
                    className="rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Replace Entire Database
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingBackup(null)}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance & Reset Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4 self-start">
          <h3 className="font-display text-base font-bold text-slate-900">
            Database Maintenance
          </h3>
          <p className="text-xs leading-relaxed text-slate-600">
            All patient records, custom test prices, billing receipts, and diagnostic reports are
            stored persistently in your browser's local IndexedDB database with automatic storage
            mirroring. Clearing browser site data removes local storage, so regular JSON backups are
            recommended.
          </p>

          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setConfirmAction('seed')}
              className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-left text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              <span>Restore Default Sample Dataset</span>
              <RotateCcw className="h-4 w-4 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction('clear')}
              className="flex w-full items-center justify-between rounded-lg border border-red-200 bg-white px-4 py-2.5 text-left text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <span>Clear Patient & Order Records (Keep Test Catalog)</span>
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Lab Profile & Receipt Configuration */}
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-slate-200 bg-white p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Laboratory Profile, Currency & Print Header
            </h3>
            <p className="text-xs text-slate-500">
              These details appear on printed payment receipts and diagnostic laboratory reports.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {settingsSavedMsg && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <Check className="h-4 w-4" />
                Settings saved
              </span>
            )}
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              Save Lab Settings
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block font-medium text-slate-700">Laboratory Name</label>
            <input
              type="text"
              value={draft.labName}
              onChange={(e) => setDraft({ ...draft, labName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Accreditation / Tagline</label>
            <input
              type="text"
              value={draft.tagline}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">License / Reg. Number</label>
            <input
              type="text"
              value={draft.licenseNumber}
              onChange={(e) => setDraft({ ...draft, licenseNumber: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Address</label>
            <input
              type="text"
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Phone</label>
            <input
              type="text"
              value={draft.phone}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700">Currency Symbol</label>
            <div className="flex gap-2">
              <select
                value={
                  CURRENCY_PRESETS.some((c) => c.symbol === draft.currencySymbol)
                    ? draft.currencySymbol
                    : 'custom'
                }
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setDraft({ ...draft, currencySymbol: e.target.value });
                  }
                }}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {CURRENCY_PRESETS.map((c) => (
                  <option key={c.label} value={c.symbol}>
                    {c.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
              <input
                type="text"
                value={draft.currencySymbol}
                onChange={(e) => setDraft({ ...draft, currencySymbol: e.target.value })}
                aria-label="Custom currency symbol"
                className="w-20 rounded-lg border border-slate-300 px-2.5 py-2 font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700">Default Tax Rate (%)</label>
            <input
              type="number"
              min={0}
              max={50}
              step="0.5"
              value={draft.taxPercent}
              onChange={(e) => setDraft({ ...draft, taxPercent: Number(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700">Default Receipt Format</label>
            <select
              value={draft.defaultReceiptFormat}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultReceiptFormat: e.target.value as 'a4' | 'thermal',
                })
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            >
              <option value="a4">A4 Full Invoice Receipt</option>
              <option value="thermal">80mm Thermal POS Receipt</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-700">Pathologist Name</label>
            <input
              type="text"
              value={draft.pathologistName}
              onChange={(e) => setDraft({ ...draft, pathologistName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Pathologist Title</label>
            <input
              type="text"
              value={draft.pathologistTitle}
              onChange={(e) => setDraft({ ...draft, pathologistTitle: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-slate-700">Lab Technologist</label>
            <input
              type="text"
              value={draft.technicianName}
              onChange={(e) => setDraft({ ...draft, technicianName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1 block font-medium text-slate-700">Receipt Footer Note</label>
            <input
              type="text"
              value={draft.receiptFooterNote}
              onChange={(e) => setDraft({ ...draft, receiptFooterNote: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Confirm Reset / Clear Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="font-display text-base font-bold text-slate-900">
                {confirmAction === 'seed'
                  ? 'Restore Default Sample Dataset?'
                  : 'Clear All Patients & Orders?'}
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {confirmAction === 'seed'
                ? 'This will replace your current patients, test catalog, and orders with the initial sample dataset.'
                : 'This will permanently delete all patient profiles and lab orders while keeping your test catalog and lab settings intact.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'seed') onResetToSeed();
                  else onClearAllRecords();
                  setConfirmAction(null);
                }}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
