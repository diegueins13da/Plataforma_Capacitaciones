interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onClose: () => void;
  deleting?: boolean;
}

export function ConfirmDeleteModal({
  title,
  message,
  confirmLabel = "Eliminar",
  variant = "danger",
  onConfirm,
  onClose,
  deleting = false,
}: Props) {
  const isDanger = variant === "danger";
  const iconCls = isDanger
    ? "w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto"
    : "w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto";
  const iconName = isDanger ? "ti-trash" : "ti-archive";
  const iconColor = isDanger ? "text-red-400" : "text-amber-400";
  const btnCls = isDanger
    ? "flex-1 px-4 py-2.5 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    : "flex-1 px-4 py-2.5 bg-amber-600 text-white text-sm rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="p-6 space-y-4">
          <div className={iconCls}>
            <i className={`ti ${iconName} text-2xl ${iconColor}`} aria-hidden="true" />
          </div>
          <div className="text-center space-y-1.5">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 border border-border text-muted-foreground text-sm rounded-xl hover:bg-accent/50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className={btnCls}
          >
            {deleting ? (
              <>
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Procesando...
              </>
            ) : (
              <>
                <i className={`ti ${iconName} text-base`} aria-hidden="true" />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
