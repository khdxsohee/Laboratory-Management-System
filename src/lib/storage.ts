import {
  LabBackupFile,
  LabDatabaseState,
  LabOrder,
  LabTest,
  Patient,
  ResultFlag,
} from '../types/lab';
import { createInitialDatabase, DEFAULT_LAB_SETTINGS } from '../data/defaultCatalog';

const IDB_NAME = 'ClariPathLimsDB';
const IDB_VERSION = 1;
const STORE_NAME = 'labState';
const STATE_KEY = 'primary_v1';
const LS_MIRROR_KEY = 'claripath_lims_state_v1';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) return true;
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore unsupported storage persist API
  }
  return false;
}

export async function loadDatabase(): Promise<LabDatabaseState> {
  try {
    const db = await openDB();
    const result = await new Promise<LabDatabaseState | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve(req.result as LabDatabaseState | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();

    if (result && Array.isArray(result.patients) && Array.isArray(result.tests) && Array.isArray(result.orders)) {
      return normalizeState(result);
    }
  } catch {
    // Fallback to localStorage mirror below
  }

  try {
    const raw = localStorage.getItem(LS_MIRROR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LabDatabaseState;
      if (parsed && Array.isArray(parsed.patients) && Array.isArray(parsed.tests) && Array.isArray(parsed.orders)) {
        const normalized = normalizeState(parsed);
        await saveDatabase(normalized);
        return normalized;
      }
    }
  } catch {
    // Fallback to initial seed database
  }

  const initial = createInitialDatabase();
  await saveDatabase(initial);
  return initial;
}

export async function saveDatabase(state: LabDatabaseState): Promise<void> {
  const updated: LabDatabaseState = {
    ...state,
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LS_MIRROR_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage quota overflow if large
  }

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(updated, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch {
    // localStorage mirror already saved
  }
}

function normalizeState(raw: Partial<LabDatabaseState>): LabDatabaseState {
  return {
    version: raw.version ?? 1,
    lastUpdated: raw.lastUpdated ?? new Date().toISOString(),
    settings: {
      ...DEFAULT_LAB_SETTINGS,
      ...(raw.settings ?? {}),
    },
    patients: Array.isArray(raw.patients) ? raw.patients : [],
    tests: Array.isArray(raw.tests) ? raw.tests : [],
    orders: Array.isArray(raw.orders) ? raw.orders : [],
  };
}

export function evaluateResultFlag(
  value: string,
  minNormal?: number,
  maxNormal?: number,
  referenceText?: string
): ResultFlag {
  const trimmed = value.trim();
  if (!trimmed) return 'Pending';

  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && (minNormal !== undefined || maxNormal !== undefined)) {
    if (minNormal !== undefined && numeric < minNormal) return 'Low';
    if (maxNormal !== undefined && numeric > maxNormal) return 'High';
    return 'Normal';
  }

  const lower = trimmed.toLowerCase();
  if (
    lower === 'positive' ||
    lower === 'reactive' ||
    lower === 'detected' ||
    lower === 'abnormal' ||
    lower === 'present'
  ) {
    if (referenceText && referenceText.toLowerCase().includes('negative')) return 'Abnormal';
    if (referenceText && referenceText.toLowerCase().includes('non-reactive')) return 'Abnormal';
    return 'Abnormal';
  }

  return 'Normal';
}

export function formatMoney(amount: number, symbol: string): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function generateNextMrn(patients: Patient[]): string {
  let maxNum = 1000;
  for (const p of patients) {
    const match = p.mrn.match(/(\d+)$/);
    if (match) {
      const n = Number(match[1]);
      if (n > maxNum) maxNum = n;
    }
  }
  return `CP-${maxNum + 1}`;
}

export function generateNextOrderNumber(orders: LabOrder[]): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `ORD-${yy}${mm}-`;
  let maxSeq = 0;
  for (const o of orders) {
    if (o.orderNumber.startsWith(prefix)) {
      const seq = Number(o.orderNumber.slice(prefix.length));
      if (!Number.isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function exportFullBackupJson(state: LabDatabaseState): void {
  const payload: LabBackupFile = {
    app: 'ClariPath LIMS',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      settings: state.settings,
      patients: state.patients,
      tests: state.tests,
      orders: state.orders,
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `claripath-lims-backup-${dateStamp}.json`);
}

export function parseAndValidateBackupJson(jsonText: string): LabBackupFile {
  const parsed = JSON.parse(jsonText) as Partial<LabBackupFile> & {
    patients?: Patient[];
    tests?: LabTest[];
    orders?: LabOrder[];
  };

  // Support both wrapped LabBackupFile and direct LabDatabaseState shapes
  if (parsed && parsed.data && Array.isArray(parsed.data.patients) && Array.isArray(parsed.data.tests) && Array.isArray(parsed.data.orders)) {
    return {
      app: 'ClariPath LIMS',
      schemaVersion: parsed.schemaVersion ?? 1,
      exportedAt: parsed.exportedAt ?? new Date().toISOString(),
      data: {
        settings: { ...DEFAULT_LAB_SETTINGS, ...(parsed.data.settings ?? {}) },
        patients: parsed.data.patients,
        tests: parsed.data.tests,
        orders: parsed.data.orders,
      },
    };
  }

  if (parsed && Array.isArray(parsed.patients) && Array.isArray(parsed.tests) && Array.isArray(parsed.orders)) {
    return {
      app: 'ClariPath LIMS',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        settings: { ...DEFAULT_LAB_SETTINGS },
        patients: parsed.patients,
        tests: parsed.tests,
        orders: parsed.orders,
      },
    };
  }

  throw new Error('Invalid ClariPath LIMS backup file format.');
}

function escapeCsvCell(val: string | number | boolean | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportPatientsCsv(patients: Patient[]): void {
  const headers = ['MRN', 'Full Name', 'Age', 'Gender', 'Phone', 'Email', 'Blood Group', 'Referring Doctor', 'Address', 'Created At'];
  const rows = patients.map((p) =>
    [p.mrn, p.fullName, p.age, p.gender, p.phone, p.email, p.bloodGroup, p.referringDoctor, p.address, p.createdAt]
      .map(escapeCsvCell)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `claripath-patients-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportOrdersCsv(orders: LabOrder[]): void {
  const headers = [
    'Order Number',
    'Date',
    'MRN',
    'Patient Name',
    'Phone',
    'Referring Doctor',
    'Priority',
    'Status',
    'Tests',
    'Subtotal',
    'Discount',
    'Tax',
    'Total Amount',
    'Amount Paid',
    'Balance Due',
    'Payment Status',
    'Payment Method',
  ];
  const rows = orders.map((o) =>
    [
      o.orderNumber,
      o.createdAt,
      o.patientSnapshot.mrn,
      o.patientSnapshot.fullName,
      o.patientSnapshot.phone,
      o.referringDoctor,
      o.priority,
      o.status,
      o.items.map((i) => i.testName).join('; '),
      o.subtotal,
      o.discountAmount,
      o.taxAmount,
      o.totalAmount,
      o.amountPaid,
      o.balanceDue,
      o.paymentStatus,
      o.paymentMethod,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `claripath-orders-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function exportTestsCsv(tests: LabTest[]): void {
  const headers = ['Code', 'Test Name', 'Category', 'Sample Type', 'TAT (Hours)', 'Price', 'Unit', 'Reference Range', 'Parameters Count', 'Active'];
  const rows = tests.map((t) =>
    [t.code, t.name, t.category, t.sampleType, t.turnaroundHours, t.price, t.unit, t.referenceText, t.parameters.length, t.active]
      .map(escapeCsvCell)
      .join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `claripath-test-catalog-${new Date().toISOString().slice(0, 10)}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
