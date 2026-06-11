interface ScoreBadgeProps {
  score: number;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const tone = score >= 70 ? 'strong' : score >= 50 ? 'ok' : 'weak';
  return (
    <span className={`score-badge ${tone}`} title="Value-Growth score (0–100)">
      {score.toFixed(0)}
    </span>
  );
}
