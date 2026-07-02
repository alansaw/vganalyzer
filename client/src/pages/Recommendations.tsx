import { Loading, ErrorState, EmptyState } from '../components/States';
import { RecoRow, RecoTableHead } from '../components/RecoRow';
import { EvaluateStock } from '../components/EvaluateStock';
import { useIsAdmin } from '../auth';
import { useRecommendations, useRefreshRecommendations } from '../hooks/queries';

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
            Value-Growth picks across US &amp; Canadian markets — ranked on PEG, forward P/E, momentum and discount to intrinsic value. Up to 50 names scoring above 35.
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
              <RecoTableHead />
              <tbody>
                {recs.data.map((r) => (
                  <RecoRow key={r.ticker} r={r} rank={r.rank} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <EvaluateStock />

      <p className="muted small disclaimer">
        For research only — not investment advice. Figures are sourced from public market data and may be delayed.
      </p>
    </div>
  );
}
