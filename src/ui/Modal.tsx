import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  testId: string;
  title: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** A dialog over everything. Nothing behind it can be used until it closes. */
export function Modal({ testId, title, wide, onClose, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={wide ? "modal modal-wide" : "modal"}
      data-testid={testId}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
