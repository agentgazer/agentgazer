import { useTranslation } from "react-i18next";

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
      <span className="font-medium">{t("common.error")}:</span> {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-3 text-red-400 hover:text-red-200">
          {t("common.retry")}
        </button>
      )}
      {onDismiss && (
        <button onClick={onDismiss} className="ml-3 text-red-400 hover:text-red-200">
          {t("common.dismiss")}
        </button>
      )}
    </div>
  );
}
