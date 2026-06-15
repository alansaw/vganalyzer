import { Link } from 'react-router-dom';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { useEtfs } from '../hooks/queries';
import { actionClass } from '../action';
import { money, percent, signClass } from '../format';

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
        <h2>Recommendation overlap</h2>
        {etfs.isLoading ? (
          <Loading label="Loading ETFs…" />
        ) : etfs.isError ? (
          <ErrorState error={etfs.error} />
        ) : !etfs.data || etfs.data.overlap.length === 0 ? (
          <EmptyState>No ETF data available.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ETF</th>
                  <th className="num">Price</th>
                  <th className="num">AUM</th>
                  <th className="num">Recommended / total holdings</th>
                  <th>Action</th>
                  <th>Why</th>
                </tr>
              </thead>
              <tbody>
                {etfs.data.overlap.map((e) => (
                  <tr key={e.symbol} data-testid="etf-row">
                    <td>
                      <span className="ticker-link">{e.symbol}</span>
                      <div className="muted small">{e.name}</div>
                    </td>
                    <td className="num">{money(e.price, e.currency)}</td>
                    <td className="num">{e.aum}</td>
                    <td className="num">
                      {e.recommendedCount} / {e.totalHoldings}
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

      {etfs.data && etfs.data.owned.length > 0 && (
        <section className="card">
          <h2>My ETFs</h2>
          <p className="muted small">
            Funds you already own, each judged by strategy: <strong>covered-call</strong> funds on
            NAV-erosion sustainability (is the distribution real income or return of capital?),
            <strong> dividend</strong> funds on capital appreciation + stable/growing distributions, and
            <strong> broad/index</strong> funds on capital appreciation. <strong>Safety</strong> tempers
            the call — leveraged funds are capped at Hold regardless of trailing return. All from the
            authoritative 1-year total return (distributions reinvested).
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ETF</th>
                  <th className="num">Price</th>
                  <th className="num">AUM</th>
                  <th className="num">Yield</th>
                  <th className="num">Div growth</th>
                  <th className="num">1Y total</th>
                  <th className="num">1Y NAV</th>
                  <th>Safety</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {etfs.data.owned.map((e) => (
                  <tr key={e.symbol} data-testid="owned-etf-row">
                    <td>
                      <span className="ticker-link">{e.symbol}</span>
                      <div className="muted small">{e.name}</div>
                    </td>
                    <td className="num">{money(e.price, e.currency)}</td>
                    <td className="num">{e.aum ?? '—'}</td>
                    <td className="num">{e.yield.toFixed(1)}%</td>
                    <td className={`num ${e.divGrowth == null ? '' : signClass(e.divGrowth)}`}>
                      {e.divGrowth == null ? '—' : `${e.divGrowth.toFixed(1)}%`}
                    </td>
                    <td className={`num ${e.totalReturn1y == null ? '' : signClass(e.totalReturn1y)}`}>
                      {e.totalReturn1y == null ? '—' : `${e.totalReturn1y.toFixed(1)}%`}
                    </td>
                    <td className={`num ${e.navChange1y == null ? '' : signClass(e.navChange1y)}`}>
                      {e.navChange1y == null ? '—' : `${e.navChange1y.toFixed(1)}%`}
                    </td>
                    <td>
                      <span className={`safety-badge safety-${e.safety}`}>{e.safety}</span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="muted small disclaimer">
        For research only — not investment advice. ETF prices and AUM are periodic snapshots; Action
        reflects only the overlap with current recommendations, not the whole fund.
      </p>
    </div>
  );
}
