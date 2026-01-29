import { motion } from "framer-motion";
import { CheckCircle, Loader2, AlertCircle } from "lucide-react";

export interface PipelineStage {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  progress?: number;
}

interface ProcessingPipelineProps {
  stages: PipelineStage[];
  currentStage?: string;
}

export function ProcessingPipeline({ stages, currentStage }: ProcessingPipelineProps) {
  return (
    <div className="flex items-center gap-2 p-4 rounded-xl bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg">
      {stages.map((stage, index) => (
        <div key={stage.id} className="flex items-center gap-2 flex-1">
          <StageIndicator stage={stage} isActive={stage.id === currentStage} />
          {index < stages.length - 1 && (
            <div className="flex-1 h-0.5 bg-gray-200 relative overflow-hidden rounded-full">
              {stage.status === "completed" && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.5 }}
                />
              )}
              {stage.status === "processing" && stage.progress !== undefined && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500"
                  style={{ width: `${stage.progress}%` }}
                />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StageIndicator({ stage, isActive }: { stage: PipelineStage; isActive: boolean }) {
  const getIcon = () => {
    switch (stage.status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  const getBackgroundClass = () => {
    switch (stage.status) {
      case "completed":
        return "bg-green-100 border-green-300";
      case "error":
        return "bg-red-100 border-red-300";
      case "processing":
        return "bg-blue-100 border-blue-300 shadow-lg shadow-blue-200/50";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <motion.div
      className="relative"
      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div
        className={`
          flex flex-col items-center gap-2 p-3 rounded-xl border-2 
          ${getBackgroundClass()} 
          transition-all duration-300
        `}
      >
        {getIcon()}
        <span
          className={`text-xs font-semibold ${
            stage.status === "processing" ? "text-blue-700" :
            stage.status === "completed" ? "text-green-700" :
            stage.status === "error" ? "text-red-700" :
            "text-gray-500"
          }`}
        >
          {stage.name}
        </span>
        {stage.status === "processing" && stage.progress !== undefined && (
          <span className="text-[10px] font-mono text-gray-600">
            {stage.progress}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
