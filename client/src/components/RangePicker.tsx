import type { Range } from '../types';

const RANGES: Range[] = ['1d', '5d', '1m', '3m', '6m', '1y', '2y', '5y'];

interface RangePickerProps {
  value: Range;
  onChange: (range: Range) => void;
}

export function RangePicker({ value, onChange }: RangePickerProps) {
  return (
    <div className="range-picker" role="group" aria-label="Date range">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={r === value ? 'active' : ''}
          aria-pressed={r === value}
          onClick={() => onChange(r)}
        >
          {r.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
