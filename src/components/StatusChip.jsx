const STATUS_TONE = {
  RECEIVED: 'neutral',
  MAPPED: 'neutral',
  VALIDATED: 'pending',
  SIGNED: 'pending',
  READY: 'positive', // has its IRN and QR
  REJECTED: 'negative',
  ERROR: 'negative',
};

/** Pass a known status string and the right color follows automatically; override with `tone` if needed. */
export default function StatusChip({ status, tone }) {
  const resolvedTone = tone || STATUS_TONE[status] || 'neutral';
  return <span className={`chip chip-${resolvedTone}`}>{status.replace(/_/g, ' ')}</span>;
}
