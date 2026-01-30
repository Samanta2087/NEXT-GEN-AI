import { memo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Scale, HelpCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

const Terms = memo(function Terms() {
    return (
        <div className="min-h-screen flex flex-col">
            <div className="container mx-auto px-4 py-8 max-w-4xl flex-1">
                {/* Back Button */}
                <Link href="/">
                    <Button variant="ghost" className="gap-2 mb-6">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </Button>
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
                                <p className="text-sm text-muted-foreground">Last updated: January 30, 2026</p>
                            </div>
                        </div>
                        <p className="text-muted-foreground">
                            Please read these terms carefully before using Grabnex services.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="prose prose-gray max-w-none space-y-8">
                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <h2 className="text-xl font-semibold m-0">Acceptance of Terms</h2>
                            </div>
                            <p className="text-muted-foreground">
                                By accessing and using Grabnex, you agree to be bound by these Terms of Service.
                                If you do not agree to these terms, please do not use our services.
                            </p>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Scale className="w-5 h-5 text-blue-600" />
                                <h2 className="text-xl font-semibold m-0">Permitted Use</h2>
                            </div>
                            <p className="text-muted-foreground mb-4">
                                Grabnex provides video to audio conversion services. You agree to:
                            </p>
                            <ul className="space-y-2 text-muted-foreground">
                                <li>• Only convert files you own or have permission to convert</li>
                                <li>• Not use our services for any illegal purposes</li>
                                <li>• Not attempt to bypass any security measures</li>
                                <li>• Respect intellectual property rights of content creators</li>
                            </ul>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                <h2 className="text-xl font-semibold m-0">Limitations</h2>
                            </div>
                            <ul className="space-y-2 text-muted-foreground">
                                <li>• Service is provided "as is" without warranties</li>
                                <li>• We are not responsible for the content you convert</li>
                                <li>• We may limit usage to prevent abuse</li>
                                <li>• Service availability is not guaranteed</li>
                            </ul>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <HelpCircle className="w-5 h-5 text-purple-600" />
                                <h2 className="text-xl font-semibold m-0">Intellectual Property</h2>
                            </div>
                            <p className="text-muted-foreground">
                                The Grabnex name, logo, and all related product and service names, design marks,
                                and slogans are trademarks of Grabnex. You must not use such marks without our
                                prior written permission.
                            </p>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-xl font-semibold m-0">Contact</h2>
                            </div>
                            <p className="text-muted-foreground">
                                For any questions regarding these Terms of Service, please contact us:
                            </p>
                            <a
                                href="mailto:samantas6085@gmail.com"
                                className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:text-blue-700 font-medium"
                            >
                                <Mail className="w-4 h-4" />
                                samantas6085@gmail.com
                            </a>
                        </section>
                    </div>
                </motion.div>
            </div>
            <Footer />
        </div>
    );
});

export default Terms;
