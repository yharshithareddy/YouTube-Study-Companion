import { useEffect, useState } from 'react';
import { Button } from './ui';

function StartSessionModal({
  open,
  onCancel,
  onConfirm,
  busy = false,
  title = 'Set session timing',
  subtitle = 'Choose the focus and break length before Focus Mode opens.',
  confirmLabel = 'Start session',
  initialFocusMinutes = 25,
  initialBreakMinutes = 5
}) {
  const [focusMinutes, setFocusMinutes] = useState(initialFocusMinutes);
  const [breakMinutes, setBreakMinutes] = useState(initialBreakMinutes);

  useEffect(() => {
    if (!open) return;
    setFocusMinutes(initialFocusMinutes);
    setBreakMinutes(initialBreakMinutes);
  }, [open, initialBreakMinutes, initialFocusMinutes]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm({
      focusMinutes: Math.min(240, Math.max(1, Math.floor(Number(focusMinutes) || 25))),
      breakMinutes: Math.min(120, Math.max(1, Math.floor(Number(breakMinutes) || 5)))
    });
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="w-[min(620px,100%)] rounded-[30px] border border-white/10 bg-[rgba(20,20,26,0.88)] p-8 text-[#F8F5F2] shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-[20px]">
        <div className="stack-md">
          <div className="stack-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[rgba(248,245,242,0.5)]">New session</p>
            <h2 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#F8F5F2]">{title}</h2>
            <p className="text-sm leading-6 text-[rgba(248,245,242,0.66)]">{subtitle}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/4 p-5">
              <span className="text-sm font-medium text-[rgba(248,245,242,0.8)]">Focus</span>
              <input
                className="rounded-[14px] border border-white/10 bg-black/18 px-4 py-3 text-lg text-[#F8F5F2] outline-none transition focus:border-orange-300/40 focus:bg-black/24"
                type="number"
                min={1}
                max={240}
                value={focusMinutes}
                onChange={(e) => setFocusMinutes(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-3 rounded-[24px] border border-white/8 bg-white/4 p-5">
              <span className="text-sm font-medium text-[rgba(248,245,242,0.8)]">Break</span>
              <input
                className="rounded-[14px] border border-white/10 bg-black/18 px-4 py-3 text-lg text-[#F8F5F2] outline-none transition focus:border-orange-300/40 focus:bg-black/24"
                type="number"
                min={1}
                max={120}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
              />
            </label>
          </div>

          <div className="inline-actions">
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={busy}
              className="rounded-[18px] border-none bg-transparent px-2 py-3 text-[rgba(248,245,242,0.66)] hover:bg-transparent hover:text-[#F8F5F2]"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              busy={busy}
              disabled={busy}
              className="rounded-[18px] border-none bg-[linear-gradient(135deg,#F97316_0%,#FB7185_100%)] px-6 py-3 text-white shadow-[0_18px_40px_rgba(249,115,22,0.24)]"
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StartSessionModal;
