import { Link } from 'react-router-dom';
import { ScoreBadge } from '../components/ScoreBadge';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { useIsAdmin } from '../auth';
import { useRecommendations, useRefreshRecommendations } from '../hooks/queries';
import { ivRangeText, money, percent, ratio, signClass } from '../format';
import { actionClass, actionForPosition } from '../action';

export function RecommendationsPage() {
  const recs = useRecommendations();
  const refresh = useRefreshRecommendations();
  const isAdmin = useIsAdmin();

  const generatedAt = recs.data?.[0]?.generatedAt;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Recommendations</h1>
          <p className="muted">
            Value-Growth picks across US &amp; Canadian markets — ranked on PEG, forward P/E, momentum and discount to intrinsic value. Names trading above their IV are excluded.
          </p>
        </div>
        {isAdmin && (
          <button className="btn primary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? 'Scanning…' : '↻ Refresh now'}
          </button>
        )}
      </header>

      {generatedAt && (
        <p className="muted small">Last generated {new Date(generatedAt).toLocaleString()}</p>
      )}

      <section className="card">
        {recs.isLoading ? (
          <Loading label="Scanning the market…" />
        ) : recs.isError ? (
          <ErrorState error={recs.error} />
        ) : !recs.data || recs.data.length === 0 ? (
          <EmptyState>No recommendations right now. Try refreshing.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>Ticker</th>
                  <th className="num">Score</th>
                  <th className="num">Price</th>
                  <th className="num">Intrinsic Value</th>
                  <th>Action</th>
                  <th className="num">Fwd P/E</th>
                  <th className="num">PEG</th>
                  <th className="num">3-mo</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {recs.data.map((r) => (
                  <tr key={r.ticker} data-testid="reco-row">
                    <td className="num muted">{r.rank}</td>
                    <td>
                      <Link to={`/positions/${encodeURIComponent(r.ticker)}`} className="ticker-link">
                        {r.ticker}
                      </Link>
                      <div className="muted small">{r.name}</div>
                    </td>
                    <td className="num">
                      <ScoreBadge score={r.score} />
                    </td>
                    <td className="num">{money(r.price, r.market === 'CA' ? 'CAD' : 'USD')}</td>
                    <td className="num">
                      {r.iv ? (
                        <>
                          {money(r.iv.base, r.market === 'CA' ? 'CAD' : 'USD')}
                          {ivRangeText(r.iv, r.market === 'CA' ? 'CAD' : 'USD') && (
                            <div className="muted small">
                              {ivRangeText(r.iv, r.market === 'CA' ? 'CAD' : 'USD')}
                            </div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {(() => {
                        const a = actionForPosition(r.price, r.iv);
                        return (
                          <span className={`action-badge ${actionClass(a.action)}`} title={a.reason}>
                            {a.action}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="num">{ratio(r.forwardPe, 1)}</td>
                    <td className="num">{ratio(r.peg)}</td>
                    <td className={`num ${signClass(r.momentum3m)}`}>{percent(r.momentum3m)}</td>
                    <td className="muted small">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted small disclaimer">
        For research only — not investment advice. Figures are sourced from public market data and may be delayed.
      </p>
    </div>
  );
}
