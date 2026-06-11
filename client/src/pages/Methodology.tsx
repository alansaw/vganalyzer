// Static reference describing exactly how the app computes each metric.
// Keep in sync with server/src/services/scoring.ts and intrinsicValue.ts.

export function MethodologyPage() {
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Methodology</h1>
          <p className="muted">How every number in VG Analyzer is calculated, at a glance.</p>
        </div>
      </header>

      <section className="card">
        <h2>At a glance</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Formula</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Intrinsic Value</strong></td>
                <td>
                  <code>IV = PV of 5 yrs of earnings/cash flow + PV of terminal value</code>
                </td>
                <td>
                  Two methods (see below): a hand-built DCF for holdings, or a computed
                  forward-earnings estimate for everything else. Pinned DCF always wins.
                </td>
              </tr>
              <tr>
                <td><strong>PEG</strong></td>
                <td>
                  <code>PEG = trailing P/E ÷ implied growth%</code>
                  <br />
                  <code>growth% = (trailing P/E ÷ forward P/E − 1) × 100</code>
                </td>
                <td>
                  Uses the 1-year earnings growth implied by the forward multiple — a
                  generous basis; a 3–5 yr CAGR would give higher (worse) PEGs. Lower is
                  better.
                </td>
              </tr>
              <tr>
                <td><strong>Forward P/E</strong></td>
                <td>
                  <code>price ÷ consensus next-year EPS</code>
                </td>
                <td>
                  Taken from the data source (not computed here). The score uses forward
                  P/E, falling back to trailing only when forward is unavailable.
                </td>
              </tr>
              <tr>
                <td><strong>Score</strong></td>
                <td>
                  <code>0.52·PEG + 0.28·FwdP/E + 0.10·momentum + 0.10·IV discount</code>
                </td>
                <td>
                  Each factor is first mapped to 0–100 points (bands below), then weighted.
                  Gated: see eligibility rules.
                </td>
              </tr>
              <tr>
                <td><strong>Grade</strong></td>
                <td>
                  <code>score → A+ / A / A- / B / C</code>
                </td>
                <td>Pure bucketing of the score (boundaries below).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Score: factor bands &amp; weights</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Factor</th>
                <th>Weight</th>
                <th>100 points when…</th>
                <th>0 points when…</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>PEG</td>
                <td className="num">52%</td>
                <td>PEG ≤ 0.5</td>
                <td>PEG = 3.0 (the gate)</td>
              </tr>
              <tr>
                <td>Forward P/E</td>
                <td className="num">28%</td>
                <td>P/E ≤ 5</td>
                <td>P/E ≥ 40</td>
              </tr>
              <tr>
                <td>3-month momentum</td>
                <td className="num">10%</td>
                <td>down 25% or more (pulled back)</td>
                <td>up 25% or more (ran up); unknown = 50 pts</td>
              </tr>
              <tr>
                <td>Discount to IV</td>
                <td className="num">10%</td>
                <td>price ≥ 50% below IV</td>
                <td>price at IV; unknown = 50 pts</td>
              </tr>
            </tbody>
          </table>
        </div>
        <h2 style={{ marginTop: 20 }}>Eligibility gates (excluded outright)</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Gate</th>
                <th>Excluded when…</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Profitability</td>
                <td>No positive P/E (unprofitable or unknown)</td>
              </tr>
              <tr>
                <td>P/E ceiling</td>
                <td>P/E (forward preferred) above 60</td>
              </tr>
              <tr>
                <td>PEG ceiling</td>
                <td>No usable PEG, or PEG above 3</td>
              </tr>
              <tr>
                <td>Intrinsic value</td>
                <td>
                  Price is <em>above</em> the IV base estimate — overvalued names never
                  appear, regardless of score
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          One formula, two uses: <strong>Recommendations and portfolio holdings share the
          exact same Score calculation</strong> (a single shared function; a regression
          test enforces they never diverge). The gates above apply only to the
          Recommendations <em>list</em> — they decide what appears, not how anything is
          scored. Holdings on the Grades page are always shown: if one breaches a gate
          (e.g. NVDA trading above its IV), it still gets its formula score, marked ★ and
          flagged “excluded from recs” instead of being hidden.
        </p>
      </section>

      <section className="card">
        <h2>Intrinsic Value: the two methods</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Method</th>
                <th>Applies to</th>
                <th>How it works</th>
                <th>Bear / Best range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Pinned DCF</strong></td>
                <td>Holdings (NVDA, SE, TCEHY)</td>
                <td>
                  Two-stage FCFF DCF: 5 yrs of free cash flow with fading growth, terminal
                  value at 3% perpetual growth, discounted at WACC (CAPM: 10-yr Treasury +
                  beta × 5% equity risk premium), minus net debt, ÷ diluted shares.
                </td>
                <td>Corners of the WACC ±1% × terminal-growth ±1% sensitivity grid.</td>
              </tr>
              <tr>
                <td><strong>Computed estimate</strong></td>
                <td>Everything else</td>
                <td>
                  Forward EPS (<code>price ÷ forward P/E</code>) grown for 5 yrs — year-1
                  growth from the trailing→forward earnings ramp (capped 2–20%), fading to
                  3% — plus a Gordon terminal value, all discounted at 11%.
                </td>
                <td>
                  Bear: half the growth, discount +1.5%. Best: 1.3× growth, discount −1.5%.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Caution: the computed estimate systematically overvalues cyclicals near an
          earnings peak (e.g. memory stocks), because it extrapolates the forward ramp.
          Treat it as a screen, not a valuation.
        </p>
      </section>

      <section className="card">
        <h2>Grade scale</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Score range</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><span className="grade-badge grade-aplus">A+</span></td>
                <td>95 and over</td>
              </tr>
              <tr>
                <td><span className="grade-badge grade-a">A</span></td>
                <td>90 – 95</td>
              </tr>
              <tr>
                <td><span className="grade-badge grade-aminus">A-</span></td>
                <td>85 – 90</td>
              </tr>
              <tr>
                <td><span className="grade-badge grade-b">B</span></td>
                <td>70 – 85</td>
              </tr>
              <tr>
                <td><span className="grade-badge grade-c">C</span></td>
                <td>below 70</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="muted small disclaimer">
        Source of truth: <code>server/src/services/scoring.ts</code> and{' '}
        <code>server/src/services/intrinsicValue.ts</code> (as of 2026-06-10). Data notes:
        prices are pinned snapshots (US via quote API, TSX via quote pages); ratios are
        real for holdings + all Canadian names, still placeholder for most US names until
        live data is wired.
      </p>
    </div>
  );
}
