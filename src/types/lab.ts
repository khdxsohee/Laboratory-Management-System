export type Gender = 'Male' | 'Female' | 'Other';

export type OrderStatus =
  | 'Pending'
  | 'Sample Collected'
  | 'In Progress'
  | 'Verified';

export type OrderPriority = 'Routine' | 'STAT';

export type PaymentMethod = 'Cash' | 'Card' | 'Bank Transfer' | 'Insurance';

export type PaymentStatus = 'Paid' | 'Partial' | 'Unpaid';

export type ResultFlag = 'Normal' | 'Low' | 'High' | 'Abnormal' | 'Pending';

export type TestCategory =
  | 'Hematology'
  | 'Biochemistry'
  | 'Endocrinology'
  | 'Microbiology'
  | 'Lipid & Cardiac'
  | 'Urinalysis'
  | 'Immunology';

export interface TestParameter {
  id: string;
  name: string;
  unit: string;
  minNormal?: number;
  maxNormal?: number;
  referenceText: string;
}

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: TestCategory;
  sampleType: string;
  turnaroundHours: number;
  price: number;
  unit: string;
  minNormal?: number;
  maxNormal?: number;
  referenceText: string;
  parameters: TestParameter[];
  active: boolean;
  createdAt: string;
}

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  bloodGroup: string;
  address: string;
  referringDoctor: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParameterResult {
  parameterId: string;
  name: string;
  value: string;
  unit: string;
  minNormal?: number;
  maxNormal?: number;
  referenceText: string;
  flag: ResultFlag;
}

export interface OrderItem {
  id: string;
  testId: string;
  testCode: string;
  testName: string;
  category: TestCategory;
  sampleType: string;
  price: number;
  unit: string;
  minNormal?: number;
  maxNormal?: number;
  referenceText: string;
  observedValue: string;
  flag: ResultFlag;
  remarks: string;
  parameterResults: ParameterResult[];
  completedAt?: string;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patientSnapshot: {
    mrn: string;
    fullName: string;
    age: number;
    gender: Gender;
    phone: string;
  };
  referringDoctor: string;
  priority: OrderPriority;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  payments: PaymentRecord[];
  clinicalNotes: string;
  collectedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabSettings {
  labName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  currencySymbol: string;
  taxPercent: number;
  defaultReceiptFormat: 'a4' | 'thermal';
  pathologistName: string;
  pathologistTitle: string;
  technicianName: string;
  receiptFooterNote: string;
}

export interface LabDatabaseState {
  version: number;
  lastUpdated: string;
  settings: LabSettings;
  patients: Patient[];
  tests: LabTest[];
  orders: LabOrder[];
}

export interface LabBackupFile {
  app: 'ClariPath LIMS';
  schemaVersion: number;
  exportedAt: string;
  data: {
    settings: LabSettings;
    patients: Patient[];
    tests: LabTest[];
    orders: LabOrder[];
  };
}
