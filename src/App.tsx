import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  TestTube2,
  DatabaseBackup,
  Plus,
  Menu,
  X,
  Microscope,
} from 'lucide-react';
import {
  LabBackupFile,
  LabDatabaseState,
  LabOrder,
  LabSettings,
  LabTest,
  Patient,
} from './types/lab';
import { createInitialDatabase } from './data/defaultCatalog';
import {
  loadDatabase,
  requestPersistentStorage,
  saveDatabase,
} from './lib/storage';
import { DashboardView } from './components/DashboardView';
import { OrdersView } from './components/OrdersView';
import { PatientsView } from './components/PatientsView';
import { CatalogView } from './components/CatalogView';
import { DataSettingsView } from './components/DataSettingsView';
import { OrderBuilderModal } from './components/OrderBuilderModal';
import { ResultsEntryModal } from './components/ResultsEntryModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';

type NavTab = 'dashboard' | 'orders' | 'patients' | 'catalog' | 'data';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders & Billing', icon: ClipboardList },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'catalog', label: 'Test Catalog', icon: TestTube2 },
  { id: 'data', label: 'Backup & Settings', icon: DatabaseBackup },
];

const PAGE_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Laboratory Overview',
    subtitle: 'Daily diagnostic throughput, active queue, and billing summary',
  },
  orders: {
    title: 'Orders, Samples & Billing',
    subtitle: 'Track specimen collection, settle balances, enter results, and print receipts',
  },
  patients: {
    title: 'Patient Directory',
    subtitle: 'Manage patient demographics, medical record numbers, and visit history',
  },
  catalog: {
    title: 'Diagnostic Test Catalog',
    subtitle: 'Configure test pricing, specimen types, turnaround times, and reference intervals',
  },
  data: {
    title: 'Backup, Export & Lab Settings',
    subtitle: 'Persistent local storage controls, JSON/CSV import-export, and receipt formatting',
  },
};

export default function App() {
  const [dbState, setDbState] = useState<LabDatabaseState | null>(null);
  const [storagePersisted, setStoragePersisted] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active modals
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [preselectedPatientId, setPreselectedPatientId] = useState<string | undefined>(undefined);
  const [resultsOrder, setResultsOrder] = useState<LabOrder | null>(null);
  const [printTarget, setPrintTarget] = useState<{
    order: LabOrder;
    mode: 'receipt' | 'report';
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loaded, persisted] = await Promise.all([
        loadDatabase(),
        requestPersistentStorage(),
      ]);
      if (!mounted) return;
      setDbState(loaded);
      setStoragePersisted(persisted);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const commitState = (updater: (prev: LabDatabaseState) => LabDatabaseState) => {
    setDbState((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      void saveDatabase(next);
      return next;
    });
  };

  const handleSavePatient = (patient: Patient) => {
    commitState((prev) => {
      const exists = prev.patients.some((p) => p.id === patient.id);
      return {
        ...prev,
        patients: exists
          ? prev.patients.map((p) => (p.id === patient.id ? patient : p))
          : [patient, ...prev.patients],
      };
    });
  };

  const handleDeletePatient = (patientId: string) => {
    commitState((prev) => ({
      ...prev,
      patients: prev.patients.filter((p) => p.id !== patientId),
    }));
  };

  const handleSaveOrder = (order: LabOrder, printAfterSave: boolean) => {
    commitState((prev) => ({
      ...prev,
      orders: [order, ...prev.orders],
    }));
    setOrderModalOpen(false);
    setPreselectedPatientId(undefined);
    if (printAfterSave) {
      setPrintTarget({ order, mode: 'receipt' });
    }
  };

  const handleUpdateOrder = (updated: LabOrder) => {
    commitState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === updated.id ? updated : o)),
    }));
  };

  const handleDeleteOrder = (orderId: string) => {
    commitState((prev) => ({
      ...prev,
      orders: prev.orders.filter((o) => o.id !== orderId),
    }));
  };

  const handleSaveResults = (updatedOrder: LabOrder, openReportAfter: boolean) => {
    handleUpdateOrder(updatedOrder);
    setResultsOrder(null);
    if (openReportAfter) {
      setPrintTarget({ order: updatedOrder, mode: 'report' });
    }
  };

  const handleSaveTest = (test: LabTest) => {
    commitState((prev) => {
      const exists = prev.tests.some((t) => t.id === test.id);
      return {
        ...prev,
        tests: exists
          ? prev.tests.map((t) => (t.id === test.id ? test : t))
          : [...prev.tests, test],
      };
    });
  };

  const handleDeleteTest = (testId: string) => {
    commitState((prev) => ({
      ...prev,
      tests: prev.tests.filter((t) => t.id !== testId),
    }));
  };

  const handleUpdateSettings = (settings: LabSettings) => {
    commitState((prev) => ({
      ...prev,
      settings,
    }));
  };

  const handleImportBackup = (backup: LabBackupFile, mode: 'merge' | 'replace') => {
    commitState((prev) => {
      if (mode === 'replace') {
        return {
          ...prev,
          settings: backup.data.settings,
          patients: backup.data.patients,
          tests: backup.data.tests,
          orders: backup.data.orders,
        };
      }

      const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
        const map = new Map<string, T>();
        for (const item of existing) map.set(item.id, item);
        for (const item of incoming) map.set(item.id, item);
        return Array.from(map.values());
      };

      return {
        ...prev,
        settings: backup.data.settings ?? prev.settings,
        patients: mergeById(prev.patients, backup.data.patients),
        tests: mergeById(prev.tests, backup.data.tests),
        orders: mergeById(prev.orders, backup.data.orders),
      };
    });
  };

  const handleResetToSeed = () => {
    const fresh = createInitialDatabase();
    setDbState(fresh);
    void saveDatabase(fresh);
  };

  const handleClearAllRecords = () => {
    commitState((prev) => ({
      ...prev,
      patients: [],
      orders: [],
    }));
  };

  const openNewOrder = (patientId?: string) => {
    setPreselectedPatientId(patientId);
    setOrderModalOpen(true);
  };

  if (!dbState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="space-y-2 text-center">
          <div className="font-display text-lg font-bold text-slate-900">ClariPath LIMS</div>
          <div className="text-xs text-slate-500">Loading persistent laboratory database...</div>
        </div>
      </div>
    );
  }

  const pageMeta = PAGE_TITLES[activeTab];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Main App Shell (hidden during window.print()) */}
      <div className="no-print flex min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white">
              <Microscope className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              ClariPath LIMS
            </span>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-800'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4 text-[11px] text-slate-500 space-y-1">
            <div className="truncate font-semibold text-slate-700">{dbState.settings.labName}</div>
            <div className="font-mono tabular-nums">
              {dbState.patients.length} patients · {dbState.orders.length} orders
            </div>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="relative z-50 flex w-64 flex-col bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
                <span className="font-display text-base font-bold text-slate-900">
                  ClariPath LIMS
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation"
                  className="rounded p-1 text-slate-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-3">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${
                        isActive
                          ? 'bg-blue-50 text-blue-800'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate font-display text-base font-bold text-slate-900 sm:text-lg">
                  {pageMeta.title}
                </h1>
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {pageMeta.subtitle}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openNewOrder()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Lab Order
            </button>
          </header>

          {/* Main Workspace */}
          <main className="mx-auto w-full max-w-[1360px] flex-1 p-4 sm:p-8">
            {activeTab === 'dashboard' && (
              <DashboardView
                orders={dbState.orders}
                patients={dbState.patients}
                settings={dbState.settings}
                onNewOrder={() => openNewOrder()}
                onOpenResults={(ord) => setResultsOrder(ord)}
                onPrintOrder={(order, mode) => setPrintTarget({ order, mode })}
                onNavigateTab={(t) => setActiveTab(t)}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView
                orders={dbState.orders}
                settings={dbState.settings}
                onNewOrder={() => openNewOrder()}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onOpenResults={(ord) => setResultsOrder(ord)}
                onPrintOrder={(order, mode) => setPrintTarget({ order, mode })}
              />
            )}

            {activeTab === 'patients' && (
              <PatientsView
                patients={dbState.patients}
                orders={dbState.orders}
                settings={dbState.settings}
                onSavePatient={handleSavePatient}
                onDeletePatient={handleDeletePatient}
                onNewOrderForPatient={(patientId) => openNewOrder(patientId)}
                onPrintOrder={(order, mode) => setPrintTarget({ order, mode })}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogView
                tests={dbState.tests}
                settings={dbState.settings}
                onSaveTest={handleSaveTest}
                onDeleteTest={handleDeleteTest}
              />
            )}

            {activeTab === 'data' && (
              <DataSettingsView
                dbState={dbState}
                storagePersisted={storagePersisted}
                onUpdateSettings={handleUpdateSettings}
                onImportBackup={handleImportBackup}
                onResetToSeed={handleResetToSeed}
                onClearAllRecords={handleClearAllRecords}
              />
            )}
          </main>
        </div>
      </div>

      {/* Global Modals */}
      {orderModalOpen && (
        <OrderBuilderModal
          patients={dbState.patients}
          tests={dbState.tests}
          orders={dbState.orders}
          settings={dbState.settings}
          preselectedPatientId={preselectedPatientId}
          onCreatePatient={handleSavePatient}
          onSaveOrder={handleSaveOrder}
          onClose={() => {
            setOrderModalOpen(false);
            setPreselectedPatientId(undefined);
          }}
        />
      )}

      {resultsOrder && (
        <ResultsEntryModal
          order={resultsOrder}
          settings={dbState.settings}
          onSaveResults={handleSaveResults}
          onClose={() => setResultsOrder(null)}
        />
      )}

      {printTarget && (
        <PrintPreviewModal
          order={printTarget.order}
          settings={dbState.settings}
          initialMode={printTarget.mode}
          onClose={() => setPrintTarget(null)}
        />
      )}
    </div>
  );
}
