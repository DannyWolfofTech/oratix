import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Isolates the TeleprompterView so a render crash mid-recording does not tear
 * down the whole app. On error we also stop any active camera/mic tracks
 * attached to <video> elements in the DOM so the hardware light turns off even
 * when the component never got a chance to run its cleanup.
 */
export class TeleprompterErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[TeleprompterErrorBoundary] Recording view crashed:", error, info.componentStack);
    try {
      document.querySelectorAll("video").forEach((el) => {
        const src = (el as HTMLVideoElement).srcObject as MediaStream | null;
        if (src && typeof src.getTracks === "function") {
          src.getTracks().forEach((t) => t.stop());
        }
        (el as HTMLVideoElement).srcObject = null;
      });
    } catch (e) {
      console.error("[TeleprompterErrorBoundary] Failed to release media tracks:", e);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Înregistrarea s-a oprit</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          A apărut o eroare în timpul redării. Camera a fost eliberată. Poți reveni la scripturi și încerca din nou.
        </p>
        <button
          onClick={this.handleReset}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Înapoi la scripturi
        </button>
      </div>
    );
  }
}
