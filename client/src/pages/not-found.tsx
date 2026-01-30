import { Link } from "wouter";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-lg"
        >
          {/* 404 Number */}
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-[150px] md:text-[200px] font-extrabold leading-none bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 bg-clip-text text-transparent select-none">
              404
            </h1>
          </motion.div>

          {/* Message */}
          <div className="space-y-4 mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              Page Not Found
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Oops! The page you're looking for doesn't exist or has been moved.
              Let's get you back on track.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/">
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              >
                <Home className="w-4 h-4" />
                Back to Home
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.history.back()}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>

          {/* Brand */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 pt-8 border-t border-gray-200"
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Grabnex
              </span>
              {" "}— Professional Media Conversion
            </p>
          </motion.div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
