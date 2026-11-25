import React, { useMemo, useState } from 'react';
import {
  Printer,
  FlaskConical,
  ArrowUpRight,
  FileText,
  CreditCard,
} from 'lucide-react';
import { LabOrder, LabSettings, Patient } from '../types/lab';
import { formatMoney, formatShortDate } from '../lib/storage';

interface DashboardViewProps {
  orders: LabOrder[];
  patients: Patient[];
  settings: LabSettings;
  onNewOrder: () => void;
  onOpenResults: (order: LabOrder) => void;
  onPrintOrder: (order: LabOrder, mode: 'receipt' | 'report') => void;
  onNavigateTab: (tab: 'orders' | 'patients' | 'catalog' | 'data') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  patients,
  settings,
  onNewOrder,
  onOpenResults,
  onPrintOrder,
  onNavigateTab,
}) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const metrics = useMemo(() => {
    const totalBilled = orders.reduce((s, o) => s + o.totalAmount, 0);
    const totalCollected = orders.reduce((s, o) => s + o.amountPaid, 0);
    const totalOutstanding = orders.reduce((s, o) => s + o.balanceDue, 0);
    const pendingLabWork = orders.filter((o) => o.status !== 'Verified').length;
    const verifiedReports = orders.filter((o) => o.status === 'Verified').length;
    const statCount = orders.filter((o) => o.priority === 'STAT' && o.status !== 'Verified').length;

    return {
      totalBilled,
      totalCollected,
      totalOutstanding,
      pendingLabWork,
      verifiedReports,
      statCount,
    };
  }, [orders]);

  // Build 7-day order & revenue series (relative to latest order date or today)
  const chartData = useMemo(() => {
    const dayMap = new Map<string, { label: string; revenue: number; count: number }>();
    const anchor = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
      dayMap.set(key, { label, revenue: 0, count: 0 });
    }
    for (const ord of orders) {
      const key = ord.createdAt.slice(0, 10);
      const bucket = dayMap.get(key);
      if (bucket) {
        bucket.revenue += ord.totalAmount;
        bucket.count += 1;
      }
    }
    return Array.from(dayMap.values());
  }, [orders]);

  const maxRevenue = Math.max(100, ...chartData.map((d) => d.revenue));

  const priorityQueue = useMemo(() => {
    return [...orders]
      .filter((o) => o.status !== 'Verified')
      .sort((a, b) => {
        if (a.priority === 'STAT' && b.priority !== 'STAT') return -1;
        if (b.priority === 'STAT' && a.priority !== 'STAT') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 5);
  }, [orders]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [orders]);

  return (
    <div className="space-y-8">
      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Collected Revenue</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {formatMoney(metrics.totalCollected, settings.currencySymbol)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Billed:{' '}
            <span className="font-mono tabular-nums text-slate-700">
              {formatMoney(metrics.totalBilled, settings.currencySymbol)}
            </span>{' '}
            · {orders.length} orders
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Outstanding Balance</div>
          <div
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              metrics.totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {formatMoney(metrics.totalOutstanding, settings.currencySymbol)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {orders.filter((o) => o.balanceDue > 0).length} orders with balance due
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Active Lab Queue</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {metrics.pendingLabWork}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span className={metrics.statCount > 0 ? 'font-semibold text-red-700' : ''}>
              {metrics.statCount} STAT urgent
            </span>{' '}
            · {metrics.verifiedReports} verified
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="text-xs font-medium text-slate-500">Registered Patients</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-slate-900">
            {patients.length}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => onNavigateTab('patients')}
              className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline"
            >
              Open directory <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Middle Analytical Row: 7-Day Revenue Chart + Active Queue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Chart Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="mb-5 flex items-baseline justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                7-Day Billing Volume
              </h3>
              <p className="text-xs text-slate-500">Daily billed order totals across the past week</p>
            </div>
            {hoveredBarIndex !== null && chartData[hoveredBarIndex] && (
              <div className="font-mono text-xs text-slate-700 tabular-nums">
                {chartData[hoveredBarIndex].label}:{' '}
                <span className="font-bold text-blue-700">
                  {formatMoney(chartData[hoveredBarIndex].revenue, settings.currencySymbol)}
                </span>{' '}
                ({chartData[hoveredBarIndex].count} orders)
              </div>
            )}
          </div>

          <div className="relative h-56 w-full">
            <svg
              viewBox="0 0 640 200"
              className="h-full w-full overflow-visible"
              role="img"
              aria-label="7-day lab billing chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const y = 165 - frac * 140;
                const val = maxRevenue * frac;
                return (
                  <g key={idx}>
                    <line
                      x1={48}
                      y1={y}
                      x2={620}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray={frac === 0 ? undefined : '3 3'}
                    />
                    <text
                      x={40}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 font-mono text-[10px]"
                    >
                      {Math.round(val)}
                    </text>
                  </g>
                );
              })}

              {chartData.map((d, idx) => {
                const slotWidth = (620 - 60) / chartData.length;
                const barWidth = Math.min(40, slotWidth * 0.52);
                const x = 60 + idx * slotWidth + (slotWidth - barWidth) / 2;
                const height = Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / maxRevenue) * 140);
                const y = 165 - height;
                const isHovered = hoveredBarIndex === idx;

                return (
                  <g
                    key={d.label}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      rx={4}
                      fill={
                        d.revenue === 0
                          ? '#e2e8f0'
                          : isHovered
                            ? '#1d4ed8'
                            : '#0f52ba'
                      }
                      className="transition-colors duration-150"
                    />
                    <text
                      x={x + barWidth / 2}
                      y={184}
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[10px]"
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Bench Work Queue */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Pending Bench Queue
              </h3>
              <p className="text-xs text-slate-500">Orders awaiting result entry or verification</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
            >
              View All
            </button>
          </div>

          {priorityQueue.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <p className="text-sm font-medium text-slate-700">All orders verified</p>
              <p className="mt-1 text-xs text-slate-500">
                Create a new lab order to start specimen processing.
              </p>
              <button
                type="button"
                onClick={onNewOrder}
                className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                New Lab Order
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {priorityQueue.map((ord) => (
                <div key={ord.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-slate-900">
                        {ord.orderNumber}
                      </span>
                      {ord.priority === 'STAT' && (
                        <span className="font-mono font-bold text-red-700">· STAT</span>
                      )}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600">{ord.status}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
                      {ord.patientSnapshot.fullName}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {ord.items.map((i) => i.testCode).join(', ')} ·{' '}
                      {ord.items.length} {ord.items.length === 1 ? 'test' : 'tests'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenResults(ord)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <FlaskConical className="h-3.5 w-3.5 text-blue-700" />
                    Enter Results
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900">
              Recent Lab Orders
            </h3>
            <p className="text-xs text-slate-500">Latest registrations, payment states, and reports</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('orders')}
            className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
          >
            Manage Orders
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No lab orders recorded yet. Click "New Lab Order" to register your first patient test.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-6 pr-3">Order #</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Tests</th>
                  <th className="py-3 px-3">Lab Status</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3 text-right">Total</th>
                  <th className="py-3 pl-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-6 pr-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {ord.orderNumber}
                      <div className="text-[11px] font-normal text-slate-500">
                        {formatShortDate(ord.createdAt)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{ord.patientSnapshot.fullName}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {ord.patientSnapshot.mrn} · {ord.patientSnapshot.age}y/{ord.patientSnapshot.gender[0]}
                      </div>
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <div className="truncate text-slate-800">
                        {ord.items.map((i) => i.testName).join(', ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          ord.status === 'Verified'
                            ? 'text-emerald-700'
                            : ord.status === 'In Progress'
                              ? 'text-blue-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {ord.status === 'Verified'
                          ? '● Verified'
                          : ord.status === 'In Progress'
                            ? '◐ In Progress'
                            : `○ ${ord.status}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          ord.paymentStatus === 'Paid'
                            ? 'text-emerald-700'
                            : ord.paymentStatus === 'Partial'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        <CreditCard className="h-3 w-3" />
                        {ord.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatMoney(ord.totalAmount, settings.currencySymbol)}
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPrintOrder(ord, 'receipt')}
                          title="Print Receipt"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Printer className="h-3 w-3" />
                          Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => onPrintOrder(ord, 'report')}
                          title="Print Lab Report"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <FileText className="h-3 w-3" />
                          Report
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
    </div>
  );
};
