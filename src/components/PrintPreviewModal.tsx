import React, { useState } from 'react';
import { Printer, X, FileText, Receipt } from 'lucide-react';
import { LabOrder, LabSettings, ResultFlag } from '../types/lab';
import { formatDateTime, formatMoney } from '../lib/storage';

interface PrintPreviewModalProps {
  order: LabOrder;
  settings: LabSettings;
  initialMode?: 'receipt' | 'report';
  onClose: () => void;
}

function BarcodeGraphic({ value }: { value: string }) {
  // Deterministic 1D barcode visual derived from orderNumber characters
  const bars: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    bars.push((code % 3) + 1, ((code >> 2) % 2) + 1, ((code >> 4) % 3) + 1, 1);
  }
  let x = 0;
  return (
    <div className="inline-flex flex-col items-center">
      <svg width="160" height="34" viewBox="0 0 180 34" aria-label={`Barcode ${value}`}>
        {bars.map((w, idx) => {
          const isBar = idx % 2 === 0;
          const rectX = x;
          x += w * 1.4;
          if (!isBar) return null;
          return <rect key={idx} x={rectX} y={0} width={w * 1.3} height={28} fill="#0f172a" />;
        })}
      </svg>
      <span className="font-mono text-[10px] tracking-widest text-slate-600">{value}</span>
    </div>
  );
}

function renderFlagText(flag: ResultFlag) {
  if (flag === 'High') return <span className="font-semibold text-red-700">▲ High</span>;
  if (flag === 'Low') return <span className="font-semibold text-amber-700">▼ Low</span>;
  if (flag === 'Abnormal') return <span className="font-semibold text-red-700">● Abnormal</span>;
  if (flag === 'Normal') return <span className="text-emerald-700">Normal</span>;
  return <span className="text-slate-400">Pending</span>;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  order,
  settings,
  initialMode = 'receipt',
  onClose,
}) => {
  const [docMode, setDocMode] = useState<'receipt' | 'report'>(initialMode);
  const [receiptSize, setReceiptSize] = useState<'a4' | 'thermal'>(settings.defaultReceiptFormat);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 backdrop-blur-[2px] print:static print:bg-white print:p-0">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Print Preview · <span className="font-mono text-slate-600">{order.orderNumber}</span>
          </h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDocMode('receipt')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                docMode === 'receipt'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              Payment Receipt
            </button>
            <button
              type="button"
              onClick={() => setDocMode('report')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                docMode === 'report'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Lab Report
            </button>
          </div>

          {docMode === 'receipt' && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setReceiptSize('a4')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  receiptSize === 'a4'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                A4 Invoice
              </button>
              <button
                type="button"
                onClick={() => setReceiptSize('thermal')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  receiptSize === 'thermal'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                80mm Thermal
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print {docMode === 'receipt' ? 'Receipt' : 'Lab Report'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </div>

      {/* Scrollable Preview Canvas */}
      <div className="flex-1 overflow-y-auto p-6 sm:p-8 print:overflow-visible print:p-0">
        {docMode === 'receipt' && receiptSize === 'thermal' ? (
          /* 80mm THERMAL POS RECEIPT */
          <div className="print-thermal-container mx-auto w-full max-w-[340px] border border-slate-300 bg-white p-5 font-mono text-xs text-slate-900 shadow-sm">
            <div className="border-b border-dashed border-slate-400 pb-3 text-center">
              <div className="text-sm font-bold uppercase tracking-tight">{settings.labName}</div>
              <div className="mt-0.5 text-[10px] text-slate-600">{settings.address}</div>
              <div className="text-[10px] text-slate-600">Tel: {settings.phone}</div>
              {settings.licenseNumber && (
                <div className="text-[10px] text-slate-500">Reg: {settings.licenseNumber}</div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 py-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt #:</span>
                <span className="font-bold">{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-semibold text-right">{order.patientSnapshot.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">MRN / Age:</span>
                <span>
                  {order.patientSnapshot.mrn} · {order.patientSnapshot.age}y/{order.patientSnapshot.gender[0]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone:</span>
                <span>{order.patientSnapshot.phone}</span>
              </div>
              {order.referringDoctor && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Ref. By:</span>
                  <span>{order.referringDoctor}</span>
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 py-2.5">
              <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase text-slate-500">
                <span>Test Description</span>
                <span>Amount</span>
              </div>
              <div className="space-y-1.5">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2 text-[11px]">
                    <div>
                      <div className="font-medium leading-tight">{item.testName}</div>
                      <div className="text-[10px] text-slate-500">{item.testCode}</div>
                    </div>
                    <span className="tabular-nums font-medium shrink-0">
                      {formatMoney(item.price, settings.currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 py-2.5 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal:</span>
                <span className="tabular-nums">{formatMoney(order.subtotal, settings.currencySymbol)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Discount:</span>
                  <span className="tabular-nums">-{formatMoney(order.discountAmount, settings.currencySymbol)}</span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax ({order.taxPercent}%):</span>
                  <span className="tabular-nums">{formatMoney(order.taxAmount, settings.currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-xs font-bold">
                <span>NET TOTAL:</span>
                <span className="tabular-nums">{formatMoney(order.totalAmount, settings.currencySymbol)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Paid ({order.paymentMethod}):</span>
                <span className="tabular-nums font-semibold">{formatMoney(order.amountPaid, settings.currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>BALANCE DUE:</span>
                <span className="tabular-nums">{formatMoney(order.balanceDue, settings.currencySymbol)}</span>
              </div>
            </div>

            <div className="pt-3 text-center space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider">
                Status: {order.paymentStatus} · {order.priority}
              </div>
              <BarcodeGraphic value={order.orderNumber} />
              <p className="text-[10px] leading-relaxed text-slate-600">{settings.receiptFooterNote}</p>
            </div>
          </div>
        ) : docMode === 'receipt' ? (
          /* A4 OFFICIAL PAYMENT RECEIPT */
          <div className="print-only-container mx-auto max-w-[820px] border border-slate-200 bg-white p-10 text-slate-900 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-6">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                  {settings.labName}
                </h1>
                <p className="mt-1 text-xs font-medium text-slate-500">{settings.tagline}</p>
                <div className="mt-3 space-y-0.5 text-xs text-slate-600">
                  <p>{settings.address}</p>
                  <p>
                    Phone: {settings.phone} · Email: {settings.email}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">License: {settings.licenseNumber}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-widest text-blue-700">
                  Official Billing Receipt
                </div>
                <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                  {order.orderNumber}
                </div>
                <div className="mt-2">
                  <BarcodeGraphic value={order.orderNumber} />
                </div>
              </div>
            </div>

            {/* Patient & Order Meta */}
            <div className="grid grid-cols-2 gap-8 border-b border-slate-200 py-5 text-xs">
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Patient Details
                </div>
                <div className="text-sm font-semibold text-slate-900">{order.patientSnapshot.fullName}</div>
                <div className="text-slate-600">
                  MRN: <span className="font-mono font-medium text-slate-900">{order.patientSnapshot.mrn}</span> ·{' '}
                  {order.patientSnapshot.age} Years · {order.patientSnapshot.gender}
                </div>
                <div className="text-slate-600">Phone: {order.patientSnapshot.phone}</div>
              </div>
              <div className="space-y-1.5 text-right">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Order Information
                </div>
                <div className="text-slate-700">
                  Issued: <span className="font-mono">{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="text-slate-700">
                  Referring Physician: <span className="font-medium text-slate-900">{order.referringDoctor || 'Self / Walk-in'}</span>
                </div>
                <div className="text-slate-700">
                  Priority: <span className="font-semibold">{order.priority}</span> · Payment:{' '}
                  <span className="font-semibold">{order.paymentStatus}</span>
                </div>
              </div>
            </div>

            {/* Itemized Tests */}
            <div className="py-6">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 pr-3">#</th>
                    <th className="py-2.5 pr-3">Code</th>
                    <th className="py-2.5 pr-3">Diagnostic Test / Panel</th>
                    <th className="py-2.5 pr-3">Sample Type</th>
                    <th className="py-2.5 text-right">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-3 font-mono tabular-nums text-slate-500">{index + 1}</td>
                      <td className="py-3 pr-3 font-mono text-slate-600">{item.testCode}</td>
                      <td className="py-3 pr-3 font-medium text-slate-900">
                        {item.testName}
                        <span className="ml-2 text-[11px] font-normal text-slate-500">· {item.category}</span>
                      </td>
                      <td className="py-3 pr-3 text-slate-600">{item.sampleType}</td>
                      <td className="py-3 text-right font-mono font-medium tabular-nums text-slate-900">
                        {formatMoney(item.price, settings.currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Payment Log */}
            <div className="flex flex-col sm:flex-row justify-between gap-8 border-t border-slate-200 pt-6">
              <div className="max-w-sm space-y-2 text-xs text-slate-600">
                <div className="font-semibold text-slate-800">Payment History</div>
                {order.payments.length === 0 ? (
                  <p className="text-slate-500">No payments recorded yet.</p>
                ) : (
                  <div className="space-y-1">
                    {order.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-4 font-mono text-[11px]">
                        <span>
                          {formatDateTime(p.date)} ({p.method})
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatMoney(p.amount, settings.currencySymbol)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="pt-3 text-[11px] leading-relaxed text-slate-500">{settings.receiptFooterNote}</p>
              </div>

              <div className="w-full sm:w-64 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatMoney(order.subtotal, settings.currencySymbol)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>
                      Discount ({order.discountType === 'percent' ? `${order.discountValue}%` : 'Flat'})
                    </span>
                    <span className="font-mono tabular-nums text-emerald-700">
                      -{formatMoney(order.discountAmount, settings.currencySymbol)}
                    </span>
                  </div>
                )}
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({order.taxPercent}%)</span>
                    <span className="font-mono tabular-nums">{formatMoney(order.taxAmount, settings.currencySymbol)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm font-bold text-slate-900">
                  <span>Net Total</span>
                  <span className="font-mono tabular-nums">{formatMoney(order.totalAmount, settings.currencySymbol)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Amount Paid</span>
                  <span className="font-mono font-semibold tabular-nums text-emerald-700">
                    {formatMoney(order.amountPaid, settings.currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                  <span className={order.balanceDue > 0 ? 'text-red-700' : 'text-slate-900'}>Balance Due</span>
                  <span className={`font-mono tabular-nums ${order.balanceDue > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                    {formatMoney(order.balanceDue, settings.currencySymbol)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-end justify-between border-t border-slate-200 pt-6 text-[11px] text-slate-500">
              <span>Generated by {settings.labName}</span>
              <div className="text-right">
                <div className="mb-1 h-6 w-44 border-b border-slate-300" />
                <span>Authorized Billing Signature</span>
              </div>
            </div>
          </div>
        ) : (
          /* A4 DIAGNOSTIC LAB REPORT */
          <div className="print-only-container mx-auto max-w-[820px] border border-slate-200 bg-white p-10 text-slate-900 shadow-sm">
            {/* Lab Header */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
                  {settings.labName}
                </h1>
                <p className="mt-0.5 text-xs font-medium text-slate-600">{settings.tagline}</p>
                <p className="mt-2 text-xs text-slate-600">
                  {settings.address} · Tel: {settings.phone}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold uppercase tracking-widest text-blue-700">
                  Diagnostic Laboratory Report
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums">{order.orderNumber}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Status: <span className="font-semibold text-slate-900">{order.status}</span>
                </div>
              </div>
            </div>

            {/* Patient Demographics Strip */}
            <div className="grid grid-cols-3 gap-4 border-b border-slate-200 bg-slate-50/70 p-4 text-xs">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Patient Name</div>
                <div className="mt-0.5 font-semibold text-slate-900">{order.patientSnapshot.fullName}</div>
                <div className="mt-0.5 text-slate-600">
                  {order.patientSnapshot.age} Years · {order.patientSnapshot.gender}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Identifiers</div>
                <div className="mt-0.5 font-mono text-slate-900">MRN: {order.patientSnapshot.mrn}</div>
                <div className="mt-0.5 text-slate-600">Ref: {order.referringDoctor || 'Self'}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Timestamps</div>
                <div className="mt-0.5 text-slate-700">
                  Collected: <span className="font-mono">{order.collectedAt ? formatDateTime(order.collectedAt) : 'Pending'}</span>
                </div>
                <div className="mt-0.5 text-slate-700">
                  Reported: <span className="font-mono">{order.verifiedAt ? formatDateTime(order.verifiedAt) : formatDateTime(order.updatedAt)}</span>
                </div>
              </div>
            </div>

            {/* Results Tables */}
            <div className="py-6 space-y-6">
              {order.items.map((item) => (
                <div key={item.id} className="border-b border-slate-200 pb-5 last:border-b-0">
                  <div className="mb-2 flex items-baseline justify-between">
                    <div>
                      <h3 className="font-display text-sm font-bold text-slate-900">{item.testName}</h3>
                      <p className="text-[11px] text-slate-500">
                        {item.category} · Specimen: {item.sampleType} · Code: {item.testCode}
                      </p>
                    </div>
                  </div>

                  {item.parameterResults.length > 0 ? (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-2 px-2">Parameter</th>
                          <th className="py-2 px-2 text-right">Observed Result</th>
                          <th className="py-2 px-2">Unit</th>
                          <th className="py-2 px-2">Reference Interval</th>
                          <th className="py-2 px-2 text-right">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.parameterResults.map((param) => (
                          <tr key={param.parameterId}>
                            <td className="py-2 px-2 font-medium text-slate-900">{param.name}</td>
                            <td
                              className={`py-2 px-2 text-right font-mono tabular-nums ${
                                param.flag === 'High' || param.flag === 'Low' || param.flag === 'Abnormal'
                                  ? 'font-bold text-red-700'
                                  : 'font-semibold text-slate-900'
                              }`}
                            >
                              {param.value || '—'}
                            </td>
                            <td className="py-2 px-2 font-mono text-slate-500">{param.unit}</td>
                            <td className="py-2 px-2 font-mono text-slate-600">{param.referenceText}</td>
                            <td className="py-2 px-2 text-right">{renderFlagText(param.flag)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-y border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-2 px-2">Investigation</th>
                          <th className="py-2 px-2 text-right">Observed Result</th>
                          <th className="py-2 px-2">Unit</th>
                          <th className="py-2 px-2">Reference Interval</th>
                          <th className="py-2 px-2 text-right">Flag</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2.5 px-2 font-medium text-slate-900">{item.testName}</td>
                          <td
                            className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                              item.flag === 'High' || item.flag === 'Low' || item.flag === 'Abnormal'
                                ? 'font-bold text-red-700'
                                : 'font-semibold text-slate-900'
                            }`}
                          >
                            {item.observedValue || '—'}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-500">{item.unit}</td>
                          <td className="py-2.5 px-2 font-mono text-slate-600">{item.referenceText}</td>
                          <td className="py-2.5 px-2 text-right">{renderFlagText(item.flag)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {item.remarks && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Interpretation / Note:</span> {item.remarks}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {order.clinicalNotes && (
              <div className="mb-6 border-t border-slate-200 pt-4 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">Clinical Notes:</span> {order.clinicalNotes}
              </div>
            )}

            {/* Verification Sign-Off */}
            <div className="mt-10 flex items-end justify-between border-t border-slate-300 pt-6 text-xs">
              <div>
                <div className="h-7 w-48 border-b border-slate-300" />
                <div className="mt-1 font-semibold text-slate-900">{settings.technicianName}</div>
                <div className="text-[11px] text-slate-500">Medical Laboratory Technologist</div>
              </div>
              <div className="text-right">
                <div className="ml-auto h-7 w-48 border-b border-slate-300" />
                <div className="mt-1 font-semibold text-slate-900">
                  {order.verifiedBy || settings.pathologistName}
                </div>
                <div className="text-[11px] text-slate-500">{settings.pathologistTitle}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
