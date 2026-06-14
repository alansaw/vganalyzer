import { Link } from 'react-router-dom';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { useEtfs } from '../hooks/queries';
import { actionClass } from '../action';
import { money, percent } from '../format';

export function EtfsPage() {
  const etfs = useEtfs();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>ETFs</h1>
          <p className="muted">
            Funds whose holdings overlap the recommendation list. Action is blended from how the
            recommended holdings inside each fund are priced vs intrinsic value (ETFs have no single IV).
          </p>
        </div>
      </header>

      <section className="card">
        {etfs.isLoading ? (
          <Loading label="Loading ETFs…" />
        ) : etfs.isError ? (
          <ErrorState error={etfs.error} />
        ) : !etfs.data || etfs.data.length === 0 ? (
          <EmptyState>No ETF data available.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ETF</th>
                  <th className="num">Price</th>
                  <th className="num">AUM</th>
                  <th className="num">Recommended holdings</th>
                  <th>Action</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {etfs.data.map((e) => (
                  <tr key={e.symbol} data-testid="etf-row">
                    <td>
                      <span className="ticker-link">{e.symbol}</span>
                      <div className="muted small">{e.name}</div>
                    </td>
                    <td className="num">{money(e.price, e.currency)}</td>
                    <td className="num">{e.aum}</td>
                    <td className="num">
                      {e.recommendedCount} / {e.holdingsCount}
                      {e.matches.length > 0 && (
                        <div className="muted small">
                          {e.matches.slice(0, 6).map((t) => (
                            <Link key={t} to={`/positions/${encodeURIComponent(t)}`} className="etf-match">
                              {t}
                            </Link>
                          ))}
                          {e.matches.length > 6 && <span> +{e.matches.length - 6}</span>}
                        </div>
                      )}
                    </td>
                    <td>
                      {e.action ? (
                        <span className={`action-badge ${actionClass(e.action)}`} title={e.reason}>
                          {e.action}
                        </span>
                      ) : (
                        <span className="muted" title={e.reason}>
                          —
                        </span>
                      )}
                    </td>
                    <td className="muted small">
                      {e.avgDiscount != null
                        ? `${percent(e.avgDiscount)} avg vs IV across ${e.recommendedCount} recommended`
                        : e.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted small disclaimer">
        For research only — not investment advice. ETF prices and AUM are periodic snapshots; Action
        reflects only the overlap with current recommendations, not the whole fund.
      </p>
    </div>
  );
}
