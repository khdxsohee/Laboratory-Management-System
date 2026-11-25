import React, { useMemo, useState } from 'react';
import { X, Search, Plus, Trash2, UserPlus, Check, Printer } from 'lucide-react';
import {
  Gender,
  LabOrder,
  LabSettings,
  LabTest,
  OrderItem,
  OrderPriority,
  Patient,
  PaymentMethod,
  TestCategory,
} from '../types/lab';
import {
  formatMoney,
  generateId,
  generateNextMrn,
  generateNextOrderNumber,
} from '../lib/storage';

interface OrderBuilderModalProps {
  patients: Patient[];
  tests: LabTest[];
  orders: LabOrder[];
  settings: LabSettings;
  preselectedPatientId?: string;
  onCreatePatient: (patient: Patient) => void;
  onSaveOrder: (order: LabOrder, printAfterSave: boolean) => void;
  onClose: () => void;
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

export const OrderBuilderModal: React.FC<OrderBuilderModalProps> = ({
  patients,
  tests,
  orders,
  settings,
  preselectedPatientId,
  onCreatePatient,
  onSaveOrder,
  onClose,
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || '');
  const [patientQuery, setPatientQuery] = useState('');
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // New patient inline form state
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState('30');
  const [newGender, setNewGender] = useState<Gender>('Male');
  const [newPhone, setNewPhone] = useState('');
  const [newDoctor, setNewDoctor] = useState('');
  const [newAddress, setNewAddress] = useState('');

  // Test catalog selection state
  const [testQuery, setTestQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | TestCategory>('All');
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);

  // Billing & order metadata
  const [referringDoctor, setReferringDoctor] = useState('');
  const [priority, setPriority] = useState<OrderPriority>('Routine');
  const [sampleCollectedNow, setSampleCollectedNow] = useState(true);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [applyTax, setApplyTax] = useState<boolean>(settings.taxPercent > 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [paymentModeChoice, setPaymentModeChoice] = useState<'full' | 'custom' | 'unpaid'>('full');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [formError, setFormError] = useState('');

  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q)
    );
  }, [patients, patientQuery]);

  const filteredTests = useMemo(() => {
    const q = testQuery.trim().toLowerCase();
    return tests.filter((t) => {
      if (!t.active) return false;
      if (activeCategory !== 'All' && t.category !== activeCategory) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tests, testQuery, activeCategory]);

  const subtotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + Number(item.price || 0), 0),
    [selectedItems]
  );

  const discountAmount = useMemo(() => {
    const raw = Math.max(0, Number(discountValue) || 0);
    if (discountType === 'percent') {
      return Math.min(subtotal, (subtotal * Math.min(100, raw)) / 100);
    }
    return Math.min(subtotal, raw);
  }, [subtotal, discountType, discountValue]);

  const taxPercent = applyTax ? settings.taxPercent : 0;
  const taxAmount = useMemo(() => {
    const taxable = Math.max(0, subtotal - discountAmount);
    return (taxable * taxPercent) / 100;
  }, [subtotal, discountAmount, taxPercent]);

  const totalAmount = useMemo(
    () => Math.max(0, subtotal - discountAmount + taxAmount),
    [subtotal, discountAmount, taxAmount]
  );

  const resolvedAmountPaid = useMemo(() => {
    if (paymentModeChoice === 'full') return totalAmount;
    if (paymentModeChoice === 'unpaid') return 0;
    const parsed = Math.max(0, Number(amountPaidInput) || 0);
    return Math.min(totalAmount, parsed);
  }, [paymentModeChoice, amountPaidInput, totalAmount]);

  const balanceDue = Math.max(0, totalAmount - resolvedAmountPaid);

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatientId(p.id);
    if (!referringDoctor && p.referringDoctor) {
      setReferringDoctor(p.referringDoctor);
    }
    setShowNewPatientForm(false);
    setFormError('');
  };

  const handleQuickCreatePatient = () => {
    if (!newName.trim() || !newPhone.trim()) {
      setFormError('Patient name and phone number are required.');
      return;
    }
    const now = new Date().toISOString();
    const patient: Patient = {
      id: generateId('pat'),
      mrn: generateNextMrn(patients),
      fullName: newName.trim(),
      age: Math.max(0, Number(newAge) || 0),
      gender: newGender,
      phone: newPhone.trim(),
      email: '',
      bloodGroup: '',
      address: newAddress.trim(),
      referringDoctor: newDoctor.trim(),
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    onCreatePatient(patient);
    setSelectedPatientId(patient.id);
    if (patient.referringDoctor) setReferringDoctor(patient.referringDoctor);
    setShowNewPatientForm(false);
    setNewName('');
    setNewPhone('');
    setNewDoctor('');
    setNewAddress('');
    setFormError('');
  };

  const toggleTest = (test: LabTest) => {
    const existing = selectedItems.find((i) => i.testId === test.id);
    if (existing) {
      setSelectedItems((prev) => prev.filter((i) => i.testId !== test.id));
      return;
    }
    const newItem: OrderItem = {
      id: generateId('item'),
      testId: test.id,
      testCode: test.code,
      testName: test.name,
      category: test.category,
      sampleType: test.sampleType,
      price: test.price,
      unit: test.unit,
      minNormal: test.minNormal,
      maxNormal: test.maxNormal,
      referenceText: test.referenceText,
      observedValue: '',
      flag: 'Pending',
      remarks: '',
      parameterResults: test.parameters.map((p) => ({
        parameterId: p.id,
        name: p.name,
        value: '',
        unit: p.unit,
        minNormal: p.minNormal,
        maxNormal: p.maxNormal,
        referenceText: p.referenceText,
        flag: 'Pending',
      })),
    };
    setSelectedItems((prev) => [...prev, newItem]);
    setFormError('');
  };

  const updateItemPrice = (itemId: string, priceStr: string) => {
    const val = Math.max(0, Number(priceStr) || 0);
    setSelectedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, price: val } : item))
    );
  };

  const handleSubmitOrder = (printAfterSave: boolean) => {
    if (!selectedPatient) {
      setFormError('Please select or register a patient before creating the order.');
      return;
    }
    if (selectedItems.length === 0) {
      setFormError('Please select at least one diagnostic test.');
      return;
    }

    const now = new Date().toISOString();
    const paymentStatus =
      balanceDue <= 0.005 ? 'Paid' : resolvedAmountPaid > 0 ? 'Partial' : 'Unpaid';

    const order: LabOrder = {
      id: generateId('ord'),
      orderNumber: generateNextOrderNumber(orders),
      patientId: selectedPatient.id,
      patientSnapshot: {
        mrn: selectedPatient.mrn,
        fullName: selectedPatient.fullName,
        age: selectedPatient.age,
        gender: selectedPatient.gender,
        phone: selectedPatient.phone,
      },
      referringDoctor: referringDoctor.trim() || selectedPatient.referringDoctor || 'Self / Walk-in',
      priority,
      status: sampleCollectedNow ? 'Sample Collected' : 'Pending',
      items: selectedItems,
      subtotal,
      discountType,
      discountValue: Number(discountValue) || 0,
      discountAmount,
      taxPercent,
      taxAmount,
      totalAmount,
      amountPaid: resolvedAmountPaid,
      balanceDue,
      paymentStatus,
      paymentMethod,
      payments:
        resolvedAmountPaid > 0
          ? [
              {
                id: generateId('pay'),
                amount: resolvedAmountPaid,
                method: paymentMethod,
                date: now,
                note: 'Payment collected at order registration',
              },
            ]
          : [],
      clinicalNotes: clinicalNotes.trim(),
      collectedAt: sampleCollectedNow ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    onSaveOrder(order, printAfterSave);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              New Lab Order & Billing
            </h2>
            <p className="text-xs text-slate-500">
              Select or register a patient, add diagnostic tests, and generate a receipt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Split */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left Column: Patient & Test Picker */}
          <div className="flex flex-col overflow-y-auto border-b border-slate-200 p-6 lg:col-span-7 lg:border-b-0 lg:border-r">
            {/* Step 1: Patient Selection */}
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  1. Patient Information
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewPatientForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {showNewPatientForm ? 'Choose Existing Patient' : 'Register New Patient'}
                </button>
              </div>

              {showNewPatientForm ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Sarah Ahmed"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Age
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={newAge}
                          onChange={(e) => setNewAge(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          Gender
                        </label>
                        <select
                          value={newGender}
                          onChange={(e) => setNewGender(e.target.value as Gender)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Phone Number *
                      </label>
                      <input
                        type="text"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+1 555-0192"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Referring Doctor
                      </label>
                      <input
                        type="text"
                        value={newDoctor}
                        onChange={(e) => setNewDoctor(e.target.value)}
                        placeholder="Dr. Malik"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Address
                      </label>
                      <input
                        type="text"
                        value={newAddress}
                        onChange={(e) => setNewAddress(e.target.value)}
                        placeholder="City / Street"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowNewPatientForm(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleQuickCreatePatient}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save & Select Patient
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)}
                      placeholder="Search patient by name, MRN (CP-1001), or phone..."
                      className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-2.5">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {selectedPatient.fullName}
                        </div>
                        <div className="text-xs text-slate-600">
                          <span className="font-mono">{selectedPatient.mrn}</span> ·{' '}
                          {selectedPatient.age} yrs · {selectedPatient.gender} ·{' '}
                          {selectedPatient.phone}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPatientId('')}
                        className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap shrink-0"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-36 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                      {filteredPatients.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-500">
                          No matching patients found. Click "Register New Patient" above.
                        </div>
                      ) : (
                        filteredPatients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPatient(p)}
                            className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-slate-50"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{p.fullName}</span>
                              <span className="ml-2 font-mono text-slate-500">{p.mrn}</span>
                            </div>
                            <span className="text-slate-500">
                              {p.age}y · {p.gender} · {p.phone}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Test Selection */}
            <div className="flex-1">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  2. Select Diagnostic Tests
                </h3>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {selectedItems.length} selected
                </span>
              </div>

              <div className="mb-3 space-y-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Filter tests by name or code (e.g. CBC, Lipid, TSH)..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        activeCategory === cat
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {filteredTests.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No tests match your filter.
                  </div>
                ) : (
                  filteredTests.map((test) => {
                    const isSelected = selectedItems.some((i) => i.testId === test.id);
                    return (
                      <button
                        key={test.id}
                        type="button"
                        onClick={() => toggleTest(test)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500">{test.code}</span>
                            <span className="truncate text-sm font-medium text-slate-900">
                              {test.name}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {test.category} · {test.sampleType} · TAT {test.turnaroundHours}h
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                            {formatMoney(test.price, settings.currencySymbol)}
                          </span>
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                              isSelected
                                ? 'border-blue-700 bg-blue-700 text-white'
                                : 'border-slate-300 bg-white text-slate-500'
                            }`}
                          >
                            {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Billing */}
          <div className="flex flex-col justify-between overflow-y-auto bg-slate-50/70 p-6 lg:col-span-5">
            <div className="space-y-5">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  3. Order Summary & Payment
                </h3>
              </div>

              {/* Order Meta Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Referring Doctor
                  </label>
                  <input
                    type="text"
                    value={referringDoctor}
                    onChange={(e) => setReferringDoctor(e.target.value)}
                    placeholder="Self / Physician Name"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Priority
                  </label>
                  <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
                    {(['Routine', 'STAT'] as OrderPriority[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 rounded-md py-1 text-xs font-medium transition-colors ${
                          priority === p
                            ? p === 'STAT'
                              ? 'bg-red-700 text-white'
                              : 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {p === 'STAT' ? 'STAT (Urgent)' : 'Routine'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sampleCollectedNow}
                  onChange={(e) => setSampleCollectedNow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span>Mark specimen as collected now</span>
              </label>

              {/* Selected Tests List with Editable Prices */}
              <div className="rounded-lg border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Selected Tests ({selectedItems.length})
                </div>
                {selectedItems.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-400">
                    Choose tests from the catalog on the left.
                  </div>
                ) : (
                  <div className="max-h-48 divide-y divide-slate-100 overflow-y-auto">
                    {selectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 px-3.5 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-slate-900">{item.testName}</div>
                          <div className="font-mono text-[11px] text-slate-400">{item.testCode}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center rounded border border-slate-200 bg-slate-50 px-1.5">
                            <span className="font-mono text-[11px] text-slate-500">
                              {settings.currencySymbol}
                            </span>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              aria-label={`Price for ${item.testName}`}
                              value={item.price}
                              onChange={(e) => updateItemPrice(item.id, e.target.value)}
                              className="w-16 bg-transparent py-1 text-right font-mono text-xs font-medium tabular-nums text-slate-900 focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedItems((prev) => prev.filter((x) => x.id !== item.id))
                            }
                            aria-label={`Remove ${item.testName}`}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount & Tax */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-white p-3.5 text-xs">
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Discount</label>
                  <div className="flex rounded-lg border border-slate-300 overflow-hidden">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percent')}
                      className="border-r border-slate-300 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none"
                    >
                      <option value="flat">{settings.currencySymbol}</option>
                      <option value="percent">%</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono tabular-nums text-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-700">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Insurance">Insurance</option>
                  </select>
                </div>

                {settings.taxPercent > 0 && (
                  <label className="col-span-2 flex items-center gap-2 pt-1 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyTax}
                      onChange={(e) => setApplyTax(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                    />
                    <span>Apply Lab Tax ({settings.taxPercent}%)</span>
                  </label>
                )}
              </div>

              {/* Payment Received */}
              <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">Payment Collected</span>
                  <div className="flex gap-1">
                    {(['full', 'custom', 'unpaid'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentModeChoice(mode)}
                        className={`rounded px-2 py-1 text-[11px] font-medium capitalize ${
                          paymentModeChoice === mode
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {mode === 'full' ? 'Full Paid' : mode === 'custom' ? 'Partial' : 'Unpaid'}
                      </button>
                    ))}
                  </div>
                </div>
                {paymentModeChoice === 'custom' && (
                  <div>
                    <input
                      type="number"
                      min={0}
                      max={totalAmount}
                      step="0.5"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder={`Enter paid amount (max ${totalAmount.toFixed(2)})`}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                )}
                <input
                  type="text"
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Optional clinical / fasting notes..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Totals Summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatMoney(subtotal, settings.currencySymbol)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">-{formatMoney(discountAmount, settings.currencySymbol)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({taxPercent}%)</span>
                    <span className="font-mono tabular-nums">{formatMoney(taxAmount, settings.currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
                  <span>Net Payable</span>
                  <span className="font-mono tabular-nums">{formatMoney(totalAmount, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Paid · Balance Due</span>
                  <span className="font-mono tabular-nums">
                    {formatMoney(resolvedAmountPaid, settings.currencySymbol)} ·{' '}
                    <span className={balanceDue > 0 ? 'font-semibold text-red-700' : 'text-emerald-700'}>
                      {formatMoney(balanceDue, settings.currencySymbol)}
                    </span>
                  </span>
                </div>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSubmitOrder(false)}
                className="rounded-lg border border-slate-900 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Save Order
              </button>
              <button
                type="button"
                onClick={() => handleSubmitOrder(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
              >
                <Printer className="h-3.5 w-3.5" />
                Save & Print Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
