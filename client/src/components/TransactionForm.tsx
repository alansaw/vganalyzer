import { useState } from 'react';
import { useAddTransaction } from '../hooks/queries';
import type { NewTransaction } from '../types';

interface TransactionFormProps {
  defaultTicker?: string;
  onAdded?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionForm({ defaultTicker = '', onAdded }: TransactionFormProps) {
  const add = useAddTransaction();
  const [ticker, setTicker] = useState(defaultTicker);
  const [type, setType] = useState<'BUY' | 'SELL'>('BUY');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [tradedOn, setTradedOn] = useState(today());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: NewTransaction = {
      ticker: ticker.trim().toUpperCase(),
      type,
      shares: Number(shares),
      price: Number(price),
      tradedOn,
      notes: notes.trim() || undefined,
    };
    if (!payload.ticker) return setError('Ticker is required.');
    if (!(payload.shares > 0)) return setError('Shares must be greater than 0.');
    if (!(payload.price >= 0)) return setError('Price must be 0 or more.');

    try {
      await add.mutateAsync(payload);
      setShares('');
      setPrice('');
      setNotes('');
      if (!defaultTicker) setTicker('');
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction.');
    }
  };

  return (
    <form className="tx-form" onSubmit={submit} aria-label="Add transaction">
      <div className="tx-grid">
        <label>
          <span>Ticker</span>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="e.g. INTC or ENB.TO"
            disabled={Boolean(defaultTicker)}
            aria-label="Ticker"
          />
        </label>
        <label>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as 'BUY' | 'SELL')} aria-label="Type">
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </label>
        <label>
          <span>Shares</span>
          <input
            type="number"
            step="any"
            min="0"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            aria-label="Shares"
          />
        </label>
        <label>
          <span>Price</span>
          <input
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            aria-label="Price"
          />
        </label>
        <label>
          <span>Date</span>
          <input type="date" value={tradedOn} onChange={(e) => setTradedOn(e.target.value)} aria-label="Date" />
        </label>
        <label className="tx-notes">
          <span>Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
        </label>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button type="submit" className="btn primary" disabled={add.isPending}>
        {add.isPending ? 'Adding…' : 'Add transaction'}
      </button>
    </form>
  );
}
