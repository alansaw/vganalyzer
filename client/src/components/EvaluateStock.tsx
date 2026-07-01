import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { RecoRow, RecoTableHead } from './RecoRow';
import type { StockEvaluation } from '../types';

// Ad-hoc scorer: enter any ticker, get a single row with the same columns as
// the recommendations table. Unlike the ranked list, this shows the stock even
// when it would be excluded (e.g. trading above IV) and notes why.
export function EvaluateStock() {
  const [symbol, setSymbol] = useState('');
  const evaluate = useMutation<StockEvaluation, Error, string>({
    mutationFn: (s: string) => api.evaluateStock(s),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = symbol.trim().toUpperCase();
    if (s) evaluate.mutate(s);
  };

  const result = evaluate.data;

  return (
    <section className="card">
      <h2>Evaluate a stock</h2>
      <p className="muted small">
        Score any ticker on the same basis as the list above. Works for names outside the screen — if a
        stock would be excluded (e.g. priced above its intrinsic value), it still shows here, with the reason.
      </p>

      <form className="evaluate-form" onSubmit={submit} aria-label="Evaluate stock">
        <input
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Ticker, e.g. AAPL or ENB.TO"
          aria-label="Stock symbol"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={12}
        />
        <button type="submit" className="btn primary" disabled={evaluate.isPending || !symbol.trim()}>
          {evaluate.isPending ? 'Scoring…' : 'Evaluate'}
        </button>
      </form>

      {evaluate.isError && (
        <div className="form-error" role="alert">
          {evaluate.error.message}
        </div>
      )}

      {result && (
        <>
          {!result.eligible && (
            <p className="muted small eval-note">
              Not eligible for the recommendation list: {result.rationale}
            </p>
          )}
          <div className="table-wrap">
            <table>
              <RecoTableHead />
              <tbody>
                <RecoRow r={result} rank="—" testid="evaluate-row" />
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
