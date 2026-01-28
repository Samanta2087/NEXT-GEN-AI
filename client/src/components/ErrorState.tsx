import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  isOffline?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorState({ 
  title = "Something went wrong", 
  message, 
  isOffline = false,
  onRetry, 
  onDismiss 
}: ErrorStateProps) {
  const Icon = isOffline ? WifiOff : AlertTriangle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="relative overflow-hidden rounded-2xl glass border-2 border-destructive/30"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent" />
      <div className="noise" />

      <div className="relative z-10 p-6">
        <div className="flex items-start gap-4">
          <motion.div
            className="p-3 rounded-xl bg-destructive/10"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Icon className="w-6 h-6 text-destructive" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>

            {isOffline && (
              <p className="text-xs text-muted-foreground mt-2">
                Your files are safe. They will be processed when you're back online.
              </p>
            )}
          </div>

          {onDismiss && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDismiss}
              className="shrink-0"
              data-testid="button-dismiss-error"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {onRetry && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={onRetry}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
              data-testid="button-retry"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function OfflineBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -50 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full glass-strong border border-amber-500/30 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <WifiOff className="w-5 h-5 text-amber-500" />
        </motion.div>
        <span className="font-medium text-foreground">You're offline</span>
        <span className="text-sm text-muted-foreground">Changes will sync when connected</span>
      </div>
    </motion.div>
  );
}
