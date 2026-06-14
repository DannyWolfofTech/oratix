import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render-time errors anywhere in the tree and shows a recoverable
 * fallback instead of a blank white screen. Strings are intentionally inlined
 * (Romanian) because this can render outside the LanguageProvider if the
 * provider itself is what threw.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Ceva nu a mers bine</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          A apărut o eroare neașteptată. Reîncarcă pagina pentru a continua.
        </p>
        <button
          onClick={this.handleReload}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Reîncarcă pagina
        </button>
      </div>
    );
  }
}
