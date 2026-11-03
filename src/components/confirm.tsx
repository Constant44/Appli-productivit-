import { create } from "zustand";
import { Modal } from "./ui";

/**
 * Confirmation intégrée à l'appli. `window.confirm()` est bloqué dans certains
 * cadres (version publiée sur claude.ai, appli installée sur l'écran d'accueil).
 */
type Ask = { message: string; okLabel: string; danger: boolean; resolve: (ok: boolean) => void };

const useConfirm = create<{ current: Ask | null }>(() => ({ current: null }));

export function ask(message: string, opts: { okLabel?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    useConfirm.setState({ current: { message, okLabel: opts.okLabel ?? "Confirmer", danger: opts.danger ?? false, resolve } });
  });
}

export function ConfirmHost() {
  const current = useConfirm((s) => s.current);
  if (!current) return null;
  const close = (ok: boolean) => {
    useConfirm.setState({ current: null });
    current.resolve(ok);
  };
  return (
    <Modal
      title="Confirmation"
      onClose={() => close(false)}
      actions={
        <>
          <button className="btn" onClick={() => close(false)}>Annuler</button>
          <button className={`btn ${current.danger ? "danger" : "primary"}`} autoFocus onClick={() => close(true)}>{current.okLabel}</button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{current.message}</p>
    </Modal>
  );
}
