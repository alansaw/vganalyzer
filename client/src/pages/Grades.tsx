import { Link } from 'react-router-dom';
import { Loading, ErrorState, EmptyState } from '../components/States';
import { usePortfolioScores, useRecommendations } from '../hooks/queries';
import { GRADES, GRADE_RANGES, gradeClass, gradeForScore, type Grade } from '../grades';

interface GradedStock {
  ticker: string;
  score: number;
  isHolding: boolean;
  reason: string | null; // gate reason for holdings excluded from recommendations
}

export function GradesPage() {
  const recs = useRecommendations();
  const holdings = usePortfolioScores();

  // Merge: recommendations + portfolio holdings (deduped; the holding flag wins).
  const byTicker = new Map<string, GradedStock>();
  for (const r of recs.data ?? []) {
    byTicker.set(r.ticker, { ticker: r.ticker, score: r.score, isHolding: false, reason: null });
  }
  for (const h of holdings.data ?? []) {
    if (h.score === null) continue; // not gradable (no PE/PEG)
    const existing = byTicker.get(h.ticker);
    if (existing) {
      existing.isHolding = true;
    } else {
      byTicker.set(h.ticker, {
        ticker: h.ticker,
        score: h.score,
        isHolding: true,
        reason: h.eligible ? null : h.reason,
      });
    }
  }

  const byGrade = new Map<Grade, GradedStock[]>(GRADES.map((g) => [g, []]));
  for (const s of byTicker.values()) {
    byGrade.get(gradeForScore(s.score))!.push(s);
  }
  for (const list of byGrade.values()) {
    list.sort((a, b) => b.score - a.score);
  }

  const generatedAt = recs.data?.[0]?.generatedAt;
  const isLoading = recs.isLoading || holdings.isLoading;
  const error = recs.isError ? recs.error : holdings.isError ? holdings.error : null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Grades</h1>
          <p className="muted">
            Recommendations and your portfolio, graded by Value-Growth score (PEG, forward P/E, momentum, discount to IV).
          </p>
        </div>
      </header>

      {generatedAt && (
        <p className="muted small">Based on recommendations generated {new Date(generatedAt).toLocaleString()}</p>
      )}

      <section className="card">
        {isLoading ? (
          <Loading label="Grading stocks…" />
        ) : error ? (
          <ErrorState error={error} />
        ) : byTicker.size === 0 ? (
          <EmptyState>No graded stocks right now. Generate recommendations first.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Stock(s)</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((grade) => {
                  const stocks = byGrade.get(grade)!;
                  return (
                    <tr key={grade} data-testid="grade-row">
                      <td className="grade-cell">
                        <span className={`grade-badge grade-${gradeClass(grade)}`}>{grade}</span>
                        <div className="muted small">{GRADE_RANGES[grade]}</div>
                      </td>
                      <td>
                        {stocks.length === 0 ? (
                          <span className="muted">—</span>
                        ) : (
                          <div className="stock-chips">
                            {stocks.map((s) => (
                              <Link
                                key={s.ticker}
                                to={`/positions/${encodeURIComponent(s.ticker)}`}
                                className={`stock-chip${s.isHolding ? ' holding' : ''}`}
                                data-testid="stock-chip"
                                title={s.reason ?? undefined}
                              >
                                {s.isHolding && <span className="holding-star">★ </span>}
                                {s.ticker}
                                <span className="muted small"> {s.score.toFixed(1)}</span>
                                {s.reason && <span className="chip-flag"> · excluded from recs</span>}
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="muted small">
        ★ = portfolio holding. Holdings are graded with the same formula but without the
        eligibility gates — if one would be excluded from Recommendations (e.g. trading above its
        intrinsic value), it still appears here, flagged.
      </p>
    </div>
  );
}
