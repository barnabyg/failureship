import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { panelText } from "../content";
import { parseSeed } from "../engine";

interface Props {
  onNewRun: () => void;
  onRestart: (seed: number) => void;
  onRefused: (typed: string) => void;
  /** The buttons used every month, which sit before the Run menu. */
  children?: ReactNode;
}

/**
 * The buttons at the right of the header, and the Run menu after them: the ways
 * out of this run. Available at every step. The seed is in the header's facts.
 */
export function RunControls({
  onNewRun,
  onRestart,
  onRefused,
  children,
}: Props) {
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // A click anywhere else puts the menu away.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => {
      document.removeEventListener("pointerdown", away);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    toggle.current?.focus();
  };

  return (
    <div className="run-controls">
      {children}
      <div
        className="run-menu"
        ref={menu}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            close();
          }
        }}
        onBlur={(event) => {
          if (!menu.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <button
          type="button"
          ref={toggle}
          className="run-menu-toggle"
          data-testid="run-menu"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen((was) => !was);
          }}
        >
          {panelText.runMenuLabel}
          <svg
            className="run-menu-chevron"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M2 4.5 6 8.5 10 4.5" />
          </svg>
        </button>
        {open && (
          <div className="run-menu-panel" id={panelId}>
            <button
              type="button"
              data-testid="new-run"
              onClick={() => {
                setOpen(false);
                onNewRun();
              }}
            >
              {panelText.newRunLabel}
            </button>
            <form
              className="run-menu-restart"
              onSubmit={(event) => {
                event.preventDefault();
                const wanted = parseSeed(typed);
                if (wanted === null) {
                  onRefused(typed);
                  return;
                }
                setTyped("");
                setOpen(false);
                onRestart(wanted);
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                aria-label={panelText.seedInputLabel}
                placeholder={panelText.seedInputLabel}
                data-testid="seed-input"
                value={typed}
                onChange={(event) => {
                  setTyped(event.target.value);
                }}
              />
              <button type="submit" data-testid="restart-seed">
                {panelText.restartLabel}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
