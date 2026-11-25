import React, { useMemo, useState } from 'react';
import {
  Search,
  Printer,
  FileText,
  FlaskConical,
  CreditCard,
  Trash2,
  X,
  Plus,
} from 'lucide-react';
import {
  LabOrder,
  LabSettings,
  OrderStatus,
  PaymentMethod,
} from '../types/lab';
import { formatDateTime, formatMoney, generateId } from '../lib/storage';

interface OrdersViewProps {
  orders: LabOrder[];
  settings: LabSettings;
  onNewOrder: () => void;
  onUpdateOrder: (order: LabOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onOpenResults: (order: LabOrder) => void;
  onPrintOrder: (order: LabOrder, mode: 'receipt' | 'report') => void;
}

const STATUS_TABS: ('All' | OrderStatus)[] = [
  'All',
  'Pending',
  'Sample Collected',
  'In Progress',
  'Verified',
];

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  settings,
  onNewOrder,
  onUpdateOrder,
  onDeleteOrder,
  onOpenResults,
  onPrintOrder,
}) => {
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Paid' | 'Unpaid/Partial'>('All');
  const [query, setQuery] = useState('');

  // Balance payment modal state
  const [paymentOrder, setPaymentOrder] = useState<LabOrder | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Cash');
  const [payNote, setPayNote] = useState('');

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...orders]
      .filter((o) => {
        if (statusFilter !== 'All' && o.status !== statusFilter) return false;
        if (paymentFilter === 'Paid' && o.paymentStatus !== 'Paid') return false;
        if (paymentFilter === 'Unpaid/Partial' && o.paymentStatus === 'Paid') return false;
        if (!q) return true;
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.patientSnapshot.fullName.toLowerCase().includes(q) ||
          o.patientSnapshot.mrn.toLowerCase().includes(q) ||
          o.patientSnapshot.phone.toLowerCase().includes(q) ||
          o.items.some((i) => i.testName.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, paymentFilter, query]);

  const handleOpenPayment = (ord: LabOrder) => {
    setPaymentOrder(ord);
    setPayAmount(ord.balanceDue.toFixed(2));
    setPayMethod(ord.paymentMethod);
    setPayNote('Balance settlement');
  };

  const handleCollectPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentOrder) return;
    const amt = Math.min(paymentOrder.balanceDue, Math.max(0, Number(payAmount) || 0));
    if (amt <= 0) return;

    const now = new Date().toISOString();
    const nextPaid = Number((paymentOrder.amountPaid + amt).toFixed(2));
    const nextBalance = Math.max(0, Number((paymentOrder.totalAmount - nextPaid).toFixed(2)));
    const nextStatus =
      nextBalance <= 0.005 ? 'Paid' : nextPaid > 0 ? 'Partial' : 'Unpaid';

    onUpdateOrder({
      ...paymentOrder,
      amountPaid: nextPaid,
      balanceDue: nextBalance,
      paymentStatus: nextStatus,
      paymentMethod: payMethod,
      payments: [
        ...paymentOrder.payments,
        {
          id: generateId('pay'),
          amount: amt,
          method: payMethod,
          date: now,
          note: payNote.trim() || 'Balance payment',
        },
      ],
      updatedAt: now,
    });
    setPaymentOrder(null);
  };

  const handleStatusChange = (ord: LabOrder, nextStatus: OrderStatus) => {
    const now = new Date().toISOString();
    onUpdateOrder({
      ...ord,
      status: nextStatus,
      collectedAt:
        nextStatus !== 'Pending' && !ord.collectedAt ? now : ord.collectedAt,
      verifiedAt: nextStatus === 'Verified' ? now : ord.verifiedAt,
      verifiedBy:
        nextStatus === 'Verified'
          ? ord.verifiedBy || settings.pathologistName
          : ord.verifiedBy,
      updatedAt: now,
    });
  };

  return (
    <div className="space-y-6">
      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as 'All' | 'Paid' | 'Unpaid/Partial')
            }
            aria-label="Filter by payment status"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
          >
            <option value="All">All Payments</option>
            <option value="Paid">Paid in Full</option>
            <option value="Unpaid/Partial">Balance Due</option>
          </select>

          <div className="relative min-w-[240px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search order #, patient, test..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">No orders match your current filters</p>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing your search or create a new laboratory order.
            </p>
            <button
              type="button"
              onClick={onNewOrder}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" />
              New Lab Order
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-5 pr-3">Order & Date</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Ordered Tests</th>
                  <th className="py-3 px-3">Workflow Stage</th>
                  <th className="py-3 px-3 text-right">Billing & Due</th>
                  <th className="py-3 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 pl-5 pr-3 whitespace-nowrap align-top">
                      <div className="font-mono font-semibold text-slate-900">
                        {ord.orderNumber}
                        {ord.priority === 'STAT' && (
                          <span className="ml-1.5 font-bold text-red-700">STAT</span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {formatDateTime(ord.createdAt)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-top">
                      <div className="font-semibold text-slate-900">
                        {ord.patientSnapshot.fullName}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono">{ord.patientSnapshot.mrn}</span> ·{' '}
                        {ord.patientSnapshot.age}y {ord.patientSnapshot.gender[0]} ·{' '}
                        {ord.patientSnapshot.phone}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-top max-w-xs">
                      <div className="font-medium text-slate-800">
                        {ord.items.map((i) => i.testName).join(', ')}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Ref: {ord.referringDoctor || 'Self'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 align-top whitespace-nowrap">
                      <select
                        value={ord.status}
                        onChange={(e) => handleStatusChange(ord, e.target.value as OrderStatus)}
                        aria-label={`Order status for ${ord.orderNumber}`}
                        className={`rounded-md border px-2 py-1 text-xs font-medium focus:outline-none ${
                          ord.status === 'Verified'
                            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                            : ord.status === 'In Progress'
                              ? 'border-blue-200 bg-blue-50/60 text-blue-800'
                              : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Sample Collected">Sample Collected</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Verified">Verified</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-3 text-right align-top whitespace-nowrap">
                      <div className="font-mono font-semibold tabular-nums text-slate-900">
                        {formatMoney(ord.totalAmount, settings.currencySymbol)}
                      </div>
                      {ord.balanceDue > 0 ? (
                        <div className="mt-0.5 font-mono text-[11px] font-semibold text-red-700 tabular-nums">
                          Due: {formatMoney(ord.balanceDue, settings.currencySymbol)}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[11px] font-medium text-emerald-700">
                          Paid · {ord.paymentMethod}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right align-top whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {ord.balanceDue > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(ord)}
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Pay Due
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenResults(ord)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <FlaskConical className="h-3.5 w-3.5 text-blue-700" />
                          Results
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintOrder(ord, 'receipt')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintOrder(ord, 'report')}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Report
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(ord.id)}
                          aria-label={`Delete order ${ord.orderNumber}`}
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
        )}
      </div>

      {/* Collect Payment Modal */}
      {paymentOrder && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCollectPayment}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Collect Balance Payment
              </h3>
              <button
                type="button"
                onClick={() => setPaymentOrder(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {paymentOrder.orderNumber} · {paymentOrder.patientSnapshot.fullName}
              </div>
              <div className="font-mono text-slate-600 tabular-nums">
                Total: {formatMoney(paymentOrder.totalAmount, settings.currencySymbol)} · Paid:{' '}
                {formatMoney(paymentOrder.amountPaid, settings.currencySymbol)} · Due:{' '}
                <span className="font-bold text-red-700">
                  {formatMoney(paymentOrder.balanceDue, settings.currencySymbol)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-700">Payment Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={paymentOrder.balanceDue}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-700">Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Insurance">Insurance</option>
                </select>
              </div>
            </div>
            <div className="text-xs">
              <label className="mb-1 block font-medium text-slate-700">Receipt Note</label>
              <input
                type="text"
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentOrder(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Record Payment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">Delete Lab Order?</h3>
            <p className="text-xs text-slate-600">
              This will permanently remove the order, its test results, and its payment log from
              persistent storage.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteOrder(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
