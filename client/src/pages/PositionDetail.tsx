import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PriceChart } from '../components/PriceChart';
import { RangePicker } from '../components/RangePicker';
import { StatCard } from '../components/StatCard';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { TransactionForm } from '../components/TransactionForm';
import { useIsAdmin } from '../auth';
import { usePositionDetail, useDeleteTransaction } from '../hooks/queries';
import { ivRangeText, ivText, ivUpside, money, number, percent, ratio, signClass } from '../format';
import type { Range } from '../types';

export function PositionDetailPage() {
  const { ticker = '' } = useParams();
  const [range, setRange] = useState<Range>('6m');
  const [showForm, setShowForm] = useState(false);
  const isAdmin = useIsAdmin();
  const detail = usePositionDetail(ticker, range);
  const del = useDeleteTransaction();

  if (detail.isLoading) return <Loading label={`Loading ${ticker}…`} />;
  if (detail.isError) return <ErrorState error={detail.error} />;

  const { position, quote, history, transactions } = detail.data!;
  const currency = quote?.currency ?? position?.currency ?? 'USD';
  const iv = quote?.iv ?? position?.iv ?? null;
  const ivUp = ivUpside(iv, quote?.price ?? position?.price);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="crumbs">
            <Link to="/">Portfolio</Link> <span>/</span> <span>{ticker}</span>
          </div>
          <h1>
            {ticker} <span className="muted normal">{quote?.name ?? position?.name ?? ''}</span>
          </h1>
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Close' : '+ Add transaction'}
          </button>
        )}
      </header>

      {isAdmin && showForm && (
        <section className="card">
          <h2>Record a buy or sell for {ticker}</h2>
          <TransactionForm defaultTicker={ticker} onAdded={() => setShowForm(false)} />
        </section>
      )}

      <section className="stat-grid">
        <StatCard label="Price" value={money(quote?.price ?? null, currency)} />
        <StatCard
          label="Intrinsic Value"
          value={ivText(iv, currency)}
          sub={
            ivRangeText(iv, currency) ??
            (ivUp != null ? `${percent(ivUp)} vs price` : undefined)
          }
          tone={(ivUp == null ? 'neutral' : ivUp >= 0 ? 'positive' : 'negative') as 'positive' | 'negative' | 'neutral'}
        />
        <StatCard label="P/E (trailing)" value={ratio(quote?.pe)} sub={`Fwd ${ratio(quote?.forwardPe)}`} />
        <StatCard label="PEG" value={ratio(quote?.peg)} />
        <StatCard label="EPS" value={money(quote?.eps ?? null, currency)} />
      </section>

      {position && position.shares > 0 ? (
        <section className="stat-grid">
          <StatCard label="Shares held" value={number(position.shares, 0)} />
          <StatCard label="Avg cost" value={money(position.avgCost, currency)} />
          <StatCard label="Market value" value={money(position.marketValue, currency)} />
          <StatCard
            label="Unrealized P/L"
            value={money(position.unrealized, currency)}
            sub={percent(position.costBasis ? position.unrealized / position.costBasis : null)}
            tone={signClass(position.unrealized) as 'positive' | 'negative' | 'neutral'}
          />
        </section>
      ) : (
        <EmptyState>You don't currently hold {ticker}. Add a buy to start tracking a position.</EmptyState>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Price history</h2>
          <RangePicker value={range} onChange={setRange} />
        </div>
        <PriceChart data={history} currency={currency} label={`${ticker} price`} />
      </section>

      <section className="card">
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <EmptyState>No transactions recorded for {ticker}.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="num">Shares</th>
                  <th className="num">Price</th>
                  <th className="num">Total</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} data-testid="tx-row">
                    <td>{t.tradedOn}</td>
                    <td>
                      <span className={`pill ${t.type === 'BUY' ? 'buy' : 'sell'}`}>{t.type}</span>
                    </td>
                    <td className="num">{number(t.shares, 0)}</td>
                    <td className="num">{money(t.price, currency)}</td>
                    <td className="num">{money(t.shares * t.price, currency)}</td>
                    <td className="muted">{t.notes ?? ''}</td>
                    <td className="num">
                      {isAdmin && (
                        <button
                          className="btn ghost danger"
                          aria-label={`Delete transaction ${t.id}`}
                          disabled={del.isPending}
                          onClick={() => del.mutate(t.id)}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
