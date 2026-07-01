import { Link } from 'react-router-dom';
import { ScoreBadge } from './ScoreBadge';
import { ivRangeText, money, percent, ratio, signClass } from '../format';
import { actionClass, actionForPosition } from '../action';

// One row of the Recommendations table — shared so the "Evaluate Stock" tool
// renders a stock with the exact same columns as the ranked list above.
export interface RecoRowData {
  ticker: string;
  name: string;
  market: string;
  price: number | null;
  forwardPe: number | null;
  peg: number | null;
  iv: { base: number; bear?: number | null; best?: number | null } | null;
  momentum3m: number | null;
  score: number;
  rationale: string;
}

interface RecoRowProps {
  r: RecoRowData;
  rank?: number | string; // the "#" cell (rank, or e.g. "—" for an ad-hoc lookup)
  testid?: string;
}

export function RecoRow({ r, rank, testid = 'reco-row' }: RecoRowProps) {
  const currency = r.market === 'CA' ? 'CAD' : 'USD';
  const a = actionForPosition(r.price, r.iv);
  return (
    <tr data-testid={testid}>
      <td className="num muted">{rank ?? ''}</td>
      <td>
        <Link to={`/positions/${encodeURIComponent(r.ticker)}`} className="ticker-link">
          {r.ticker}
        </Link>
        <div className="muted small">{r.name}</div>
      </td>
      <td className="num">
        <ScoreBadge score={r.score} />
      </td>
      <td className="num">{money(r.price, currency)}</td>
      <td className="num">
        {r.iv ? (
          <>
            {money(r.iv.base, currency)}
            {ivRangeText(r.iv, currency) && <div className="muted small">{ivRangeText(r.iv, currency)}</div>}
          </>
        ) : (
          '—'
        )}
      </td>
      <td>
        <span className={`action-badge ${actionClass(a.action)}`} title={a.reason}>
          {a.action}
        </span>
      </td>
      <td className="num">{ratio(r.forwardPe, 1)}</td>
      <td className="num">{ratio(r.peg)}</td>
      <td className={`num ${signClass(r.momentum3m)}`}>{percent(r.momentum3m)}</td>
      <td className="muted small col-why">{r.rationale}</td>
    </tr>
  );
}

// The shared column header, so both tables line up exactly.
export function RecoTableHead() {
  return (
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
        <th className="col-why">Why</th>
      </tr>
    </thead>
  );
}
