export default function Skeleton({ lines = 3, tall = false }) {
  return (
    <div className={`skeleton${tall ? " skeleton-tall" : ""}`} aria-busy="true" aria-label="טוען">
      {Array.from({ length: lines }, (_, i) => <span key={i} style={{ width: `${92 - i * 14}%` }} />)}
    </div>
  );
}
