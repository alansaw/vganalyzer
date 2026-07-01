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
                  Two methods (see below): a per-stock DCF with its own assumptions for pinned
                  names, or a computed forward-earnings estimate as fallback. Pinned DCF always wins.
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
                <td><strong>Per-stock DCF</strong></td>
                <td>Names with pinned assumptions (NVDA, SE, TCEHY, MU, GOOGL, AMZN)</td>
                <td>
                  Two-stage discounted-earnings model where <strong>each stock carries its own
                  assumptions</strong>: an anchor forward EPS/FCF-per-share (<code>eps0</code>),
                  near-term <code>growth</code> fading linearly to <code>terminalGrowth</code> over
                  5 yrs, a Gordon terminal value, all discounted at that stock&rsquo;s own{' '}
                  <code>discountRate</code>, plus <code>netCashPerShare</code>. No single generic
                  rate — a wide-moat compounder, a margin-inflecting platform, and a cyclical
                  commodity are each valued on their merits.
                </td>
                <td>
                  Bear: 0.7× growth &amp; discount +1%. Best: 1.3× growth &amp; discount −1%.
                </td>
              </tr>
              <tr>
                <td><strong>Computed estimate</strong></td>
                <td>Everything else (fallback)</td>
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

        <h2 style={{ marginTop: 20 }}>Pinned DCF assumptions, per stock</h2>
        <div className="table-wrap">
          <table className="methodology">
            <thead>
              <tr>
                <th>Stock</th>
                <th className="num">Anchor EPS</th>
                <th className="num">Near-term growth</th>
                <th className="num">Terminal g</th>
                <th className="num">Discount</th>
                <th className="num">IV base</th>
                <th>Thesis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>NVDA</td><td className="num">$8.97</td><td className="num">30%</td>
                <td className="num">4%</td><td className="num">10.5%</td><td className="num">$249</td>
                <td>High beta; Blackwell/Rubin structural upgrade cycle.</td>
              </tr>
              <tr>
                <td>GOOGL</td><td className="num">$14.55</td><td className="num">12%</td>
                <td className="num">3.5%</td><td className="num">9%</td><td className="num">$337</td>
                <td>Wide moat, big cash buffer; search maturing, cloud scaling.</td>
              </tr>
              <tr>
                <td>AMZN</td><td className="num">$9.50</td><td className="num">24%</td>
                <td className="num">4%</td><td className="num">9.25%</td><td className="num">$293</td>
                <td>FCF masked by capex depreciation; AWS + automation.</td>
              </tr>
              <tr>
                <td>SE</td><td className="num">$6.00</td><td className="num">20%</td>
                <td className="num">4%</td><td className="num">11.5%</td><td className="num">$128</td>
                <td>Profitability inflection; EM risk premium.</td>
              </tr>
              <tr>
                <td>MU</td><td className="num">$75.00</td><td className="num">15%</td>
                <td className="num">3%</td><td className="num">11%</td><td className="num">$1,253</td>
                <td>Normalized mid-cycle EPS (below peak); HBM pricing; cyclical.</td>
              </tr>
              <tr>
                <td>TCEHY</td><td className="num">$3.45</td><td className="num">11%</td>
                <td className="num">3%</td><td className="num">10%</td><td className="num">$66</td>
                <td>Steady gaming + WeChat Pay; China geopolitical premium.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Assumptions live in <code>server/data/manual-prices.json</code> as a per-ticker{' '}
          <code>dcf</code> block — change any number and the IV recomputes. The thesis behind each
          is also shown in the &ldquo;Why&rdquo; column on Recommendations. Caution: the fallback
          computed estimate systematically overvalues cyclicals near an earnings peak; and MU&rsquo;s
          $1,253 rests on an aggressive normalized-EPS/HBM thesis — treat its wide bear band as real.
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
