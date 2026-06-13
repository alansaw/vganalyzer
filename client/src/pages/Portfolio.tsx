import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PriceChart } from '../components/PriceChart';
import { RangePicker } from '../components/RangePicker';
import { StatCard } from '../components/StatCard';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { TransactionForm } from '../components/TransactionForm';
import { useIsAdmin } from '../auth';
import { usePortfolio, usePortfolioHistory } from '../hooks/queries';
import { ivRangeText, money, number, percent, signClass } from '../format';
import { actionClass, actionForPosition } from '../action';
import type { Range } from '../types';

export function PortfolioPage() {
  const [range, setRange] = useState<Range>('1m');
  const [showForm, setShowForm] = useState(false);
  const isAdmin = useIsAdmin();
  const qc = useQueryClient();
  const portfolio = usePortfolio();
  const history = usePortfolioHistory(range);
  const isRefreshing = portfolio.isFetching || history.isFetching;

  const refresh = () => qc.invalidateQueries({ queryKey: ['portfolio'] });

  if (portfolio.isLoading) return <Loading label="Loading portfolio…" />;
  if (portfolio.isError) return <ErrorState error={portfolio.error} />;

  const data = portfolio.data!;
  const open = data.positions.filter((p) => p.shares > 0);
  const closed = data.positions.filter((p) => p.shares === 0);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p className="muted">Your positions, total value and performance over time.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
          {isAdmin && (
            <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
              {showForm ? 'Close' : '+ Add transaction'}
            </button>
          )}
        </div>
      </header>

      {isAdmin && showForm && (
        <section className="card">
          <h2>Record a buy or sell</h2>
          <TransactionForm onAdded={() => setShowForm(false)} />
        </section>
      )}

      <section className="stat-grid">
        <StatCard label="Total Value" value={money(data.totalValue)} />
        <StatCard
          label="Unrealized P/L"
          value={money(data.unrealized)}
          sub={percent(data.totalCost ? data.unrealized / data.totalCost : null)}
          tone={signClass(data.unrealized) as 'positive' | 'negative' | 'neutral'}
        />
        <StatCard
          label="Realized P/L"
          value={money(data.realized)}
          tone={signClass(data.realized) as 'positive' | 'negative' | 'neutral'}
        />
        <StatCard
          label="Total Gain"
          value={money(data.totalGain)}
          tone={signClass(data.totalGain) as 'positive' | 'negative' | 'neutral'}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Portfolio value</h2>
          <RangePicker value={range} onChange={setRange} />
        </div>
        {history.isLoading ? (
          <Loading />
        ) : history.isError ? (
          <ErrorState error={history.error} />
        ) : (
          <PriceChart data={history.data?.points ?? []} label="Portfolio value" />
        )}
      </section>

      <section className="card">
        <h2>Open positions</h2>
        {open.length === 0 ? (
          <EmptyState>No open positions yet. Add a buy to get started.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th className="num">Shares</th>
                  <th className="num">Avg cost</th>
                  <th className="num">Price</th>
                  <th className="num">IV (Bear–Best)</th>
                  <th>Action</th>
                  <th className="num">Mkt value</th>
                  <th className="num">Unrealized</th>
                  <th className="num">Weight</th>
                </tr>
              </thead>
              <tbody>
                {open.map((p) => (
                  <tr key={p.ticker} data-testid="position-row">
                    <td>
                      <Link to={`/positions/${encodeURIComponent(p.ticker)}`} className="ticker-link">
                        {p.ticker}
                      </Link>
                      <div className="muted small">{p.name}</div>
                    </td>
                    <td className="num">{number(p.shares, 0)}</td>
                    <td className="num">{money(p.avgCost, p.currency ?? 'USD')}</td>
                    <td className="num">{money(p.price, p.currency ?? 'USD')}</td>
                    <td className="num">
                      {p.iv ? (
                        <>
                          {money(p.iv.base, p.currency ?? 'USD')}
                          {ivRangeText(p.iv, p.currency ?? 'USD') && (
                            <div className="muted small">{ivRangeText(p.iv, p.currency ?? 'USD')}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {(() => {
                        const a = actionForPosition(p.price, p.iv);
                        return (
                          <span className={`action-badge ${actionClass(a.action)}`} title={a.reason}>
                            {a.action}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="num">{money(p.marketValue, p.currency ?? 'USD')}</td>
                    <td className={`num ${signClass(p.unrealized)}`}>{money(p.unrealized, p.currency ?? 'USD')}</td>
                    <td className="num">{percent(p.weight)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="card">
          <h2>Closed positions</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th className="num">Realized P/L</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((p) => (
                  <tr key={p.ticker}>
                    <td>
                      <Link to={`/positions/${encodeURIComponent(p.ticker)}`} className="ticker-link">
                        {p.ticker}
                      </Link>
                    </td>
                    <td className={`num ${signClass(p.realized)}`}>{money(p.realized, p.currency ?? 'USD')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
