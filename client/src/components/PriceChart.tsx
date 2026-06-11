import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PricePoint } from '../types';
import { money } from '../format';

interface PriceChartProps {
  data: PricePoint[];
  currency?: string;
  height?: number;
  label?: string;
}

export function PriceChart({ data, currency = 'USD', height = 280, label = 'Value' }: PriceChartProps) {
  if (!data || data.length === 0) {
    return <div className="chart-empty">No history available.</div>;
  }

  const first = data[0].close;
  const last = data[data.length - 1].close;
  const up = last >= first;
  const stroke = up ? '#16a34a' : '#dc2626';

  return (
    <div className="chart-wrap" data-testid="price-chart">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="95%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            minTickGap={48}
            tickFormatter={(d: string) => (d.includes('T') ? d.slice(5, 16).replace('T', ' ') : d.slice(2))}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            domain={['auto', 'auto']}
            width={64}
            tickFormatter={(v: number) => money(v, currency).replace(/\.00$/, '')}
          />
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            labelStyle={{ color: '#e2e8f0' }}
            formatter={(v: number) => [money(v, currency), label]}
          />
          <Area type="monotone" dataKey="close" stroke={stroke} strokeWidth={2} fill="url(#fill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
