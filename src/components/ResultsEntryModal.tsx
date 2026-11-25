import React, { useState } from 'react';
import { X, CheckCircle2, FileText } from 'lucide-react';
import { LabOrder, LabSettings, OrderItem, OrderStatus, ResultFlag } from '../types/lab';
import { evaluateResultFlag } from '../lib/storage';

interface ResultsEntryModalProps {
  order: LabOrder;
  settings: LabSettings;
  onSaveResults: (updatedOrder: LabOrder, openReportAfter: boolean) => void;
  onClose: () => void;
}

function FlagIndicator({ flag }: { flag: ResultFlag }) {
  if (flag === 'High') {
    return <span className="font-mono text-xs font-semibold text-red-700">▲ High</span>;
  }
  if (flag === 'Low') {
    return <span className="font-mono text-xs font-semibold text-amber-700">▼ Low</span>;
  }
  if (flag === 'Abnormal') {
    return <span className="font-mono text-xs font-semibold text-red-700">● Abnormal</span>;
  }
  if (flag === 'Normal') {
    return <span className="font-mono text-xs font-medium text-emerald-700">● Normal</span>;
  }
  return <span className="font-mono text-xs text-slate-400">○ Pending</span>;
}

export const ResultsEntryModal: React.FC<ResultsEntryModalProps> = ({
  order,
  settings,
  onSaveResults,
  onClose,
}) => {
  const [items, setItems] = useState<OrderItem[]>(() =>
    JSON.parse(JSON.stringify(order.items)) as OrderItem[]
  );
  const [verifiedBy, setVerifiedBy] = useState(order.verifiedBy || settings.pathologistName);
  const [clinicalNotes, setClinicalNotes] = useState(order.clinicalNotes || '');

  const handleSingleValueChange = (itemId: string, val: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const flag = evaluateResultFlag(val, item.minNormal, item.maxNormal, item.referenceText);
        return {
          ...item,
          observedValue: val,
          flag,
          completedAt: val.trim() ? new Date().toISOString() : undefined,
        };
      })
    );
  };

  const handleParamValueChange = (itemId: string, paramId: string, val: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const nextParams = item.parameterResults.map((p) => {
          if (p.parameterId !== paramId) return p;
          return {
            ...p,
            value: val,
            flag: evaluateResultFlag(val, p.minNormal, p.maxNormal, p.referenceText),
          };
        });
        const anyAbnormal = nextParams.some(
          (p) => p.flag === 'High' || p.flag === 'Low' || p.flag === 'Abnormal'
        );
        const allEntered = nextParams.every((p) => p.value.trim() !== '');
        return {
          ...item,
          parameterResults: nextParams,
          flag: !allEntered
            ? anyAbnormal
              ? 'Abnormal'
              : 'Pending'
            : anyAbnormal
              ? 'Abnormal'
              : 'Normal',
          completedAt: allEntered ? new Date().toISOString() : undefined,
        };
      })
    );
  };

  const handleRemarksChange = (itemId: string, remarks: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, remarks } : item))
    );
  };

  const saveWithStatus = (verifyNow: boolean, openReportAfter: boolean) => {
    const now = new Date().toISOString();
    const anyEntered = items.some((item) =>
      item.parameterResults.length > 0
        ? item.parameterResults.some((p) => p.value.trim() !== '')
        : item.observedValue.trim() !== ''
    );
    const nextStatus: OrderStatus = verifyNow
      ? 'Verified'
      : anyEntered
        ? 'In Progress'
        : order.status;

    const updatedOrder: LabOrder = {
      ...order,
      items,
      clinicalNotes,
      status: nextStatus,
      collectedAt: order.collectedAt || now,
      verifiedAt: verifyNow ? now : order.verifiedAt,
      verifiedBy: verifyNow ? verifiedBy.trim() || settings.pathologistName : order.verifiedBy,
      updatedAt: now,
    };
    onSaveResults(updatedOrder, openReportAfter);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Diagnostic Results Entry ·{' '}
              <span className="font-mono text-blue-700">{order.orderNumber}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {order.patientSnapshot.fullName} · {order.patientSnapshot.mrn} ·{' '}
              {order.patientSnapshot.age}y {order.patientSnapshot.gender} · Ref:{' '}
              {order.referringDoctor}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close results entry"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="font-display text-sm font-semibold text-slate-900">
                    {item.testName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.testCode} · {item.category} · Specimen: {item.sampleType}
                  </div>
                </div>
                <FlagIndicator flag={item.flag} />
              </div>

              <div className="p-4 space-y-3">
                {item.parameterResults.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="py-2 pr-3">Parameter</th>
                          <th className="py-2 pr-3 w-40">Observed Value</th>
                          <th className="py-2 pr-3">Unit</th>
                          <th className="py-2 pr-3">Reference Range</th>
                          <th className="py-2 text-right">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {item.parameterResults.map((param) => (
                          <tr key={param.parameterId}>
                            <td className="py-2.5 pr-3 font-medium text-slate-900">{param.name}</td>
                            <td className="py-2.5 pr-3">
                              <input
                                type="text"
                                value={param.value}
                                onChange={(e) =>
                                  handleParamValueChange(item.id, param.parameterId, e.target.value)
                                }
                                placeholder="Enter value..."
                                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 pr-3 font-mono text-slate-500">{param.unit}</td>
                            <td className="py-2.5 pr-3 font-mono text-slate-600">
                              {param.referenceText}
                            </td>
                            <td className="py-2.5 text-right whitespace-nowrap">
                              <FlagIndicator flag={param.flag} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-center">
                    <div className="sm:col-span-5">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Observed Result ({item.unit})
                      </label>
                      <input
                        type="text"
                        value={item.observedValue}
                        onChange={(e) => handleSingleValueChange(item.id, e.target.value)}
                        placeholder={
                          item.unit === 'qual' ? 'Negative / Positive' : 'Enter numeric value...'
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <div className="text-[11px] font-medium text-slate-500">Reference Range</div>
                      <div className="mt-0.5 font-mono text-xs text-slate-800">
                        {item.referenceText}
                      </div>
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <FlagIndicator flag={item.flag} />
                    </div>
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    value={item.remarks}
                    onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                    placeholder="Optional pathologist / bench remarks for this test..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Verifying Pathologist
              </label>
              <input
                type="text"
                value={verifiedBy}
                onChange={(e) => setVerifiedBy(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Overall Clinical / Report Notes
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Clinical correlation advised..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => saveWithStatus(false, false)}
              className="rounded-lg border border-slate-900 bg-white px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => saveWithStatus(true, false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save & Verify Report
            </button>
            <button
              type="button"
              onClick={() => saveWithStatus(true, true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <FileText className="h-3.5 w-3.5" />
              Verify & Print Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
