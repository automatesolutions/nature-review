"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="login">
      <div className="login-card">
        <h1>This page failed to load</h1>
        <p className="error">{error.message}</p>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
