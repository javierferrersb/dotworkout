export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: "info" | "success" | "warn";
  readonly action: ToastAction | undefined;
}

const VISIBLE_MS = 4200;

/** One message at a time, announced politely, with at most one action such as Undo. */
class Toasts {
  current = $state<Toast | undefined>(undefined);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastId = 0;

  show(message: string, tone: Toast["tone"] = "info", action?: ToastAction): void {
    this.lastId += 1;
    this.current = { id: this.lastId, message, tone, action };
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => this.clear(),
      action === undefined ? VISIBLE_MS : VISIBLE_MS + 2000,
    );
  }

  clear(): void {
    clearTimeout(this.timer);
    this.current = undefined;
  }
}

export const toasts = new Toasts();
