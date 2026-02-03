interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
      <span className="font-medium">Error:</span> {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 text-red-400 hover:text-red-200">
          Retry
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-3 text-red-400 hover:text-red-200">
          Dismiss
        </button>
      )}
    </div>
  );
}
