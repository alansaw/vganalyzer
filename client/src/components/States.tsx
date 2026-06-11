export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state loading" role="status">
      {label}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="state error" role="alert">
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="state empty">{children}</div>;
}
