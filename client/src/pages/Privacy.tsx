import { memo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Eye, Server, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";

const PrivacyPolicy = memo(function PrivacyPolicy() {
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
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
                                <p className="text-sm text-muted-foreground">Last updated: January 30, 2026</p>
                            </div>
                        </div>
                        <p className="text-muted-foreground">
                            At Grabnex, we take your privacy seriously. This policy explains how we handle your data.
                        </p>
                    </div>

                    {/* Content */}
                    <div className="prose prose-gray max-w-none space-y-8">
                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Lock className="w-5 h-5 text-blue-600" />
                                <h2 className="text-xl font-semibold m-0">Data Collection</h2>
                            </div>
                            <p className="text-muted-foreground">
                                Grabnex is designed with privacy in mind. We process your files directly in your browser
                                whenever possible:
                            </p>
                            <ul className="space-y-2 text-muted-foreground mt-4">
                                <li>• <strong>Uploaded Files:</strong> Files you upload are processed temporarily and automatically deleted after conversion.</li>
                                <li>• <strong>No Account Required:</strong> We don't require registration to use our services.</li>
                                <li>• <strong>Minimal Logging:</strong> We only log basic usage statistics to improve our service.</li>
                            </ul>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Eye className="w-5 h-5 text-purple-600" />
                                <h2 className="text-xl font-semibold m-0">Information We Don't Collect</h2>
                            </div>
                            <ul className="space-y-2 text-muted-foreground">
                                <li>• We don't store your converted files permanently</li>
                                <li>• We don't sell or share your personal information</li>
                                <li>• We don't track your browsing activity across other websites</li>
                                <li>• We don't use cookies for advertising purposes</li>
                            </ul>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Server className="w-5 h-5 text-orange-600" />
                                <h2 className="text-xl font-semibold m-0">Data Security</h2>
                            </div>
                            <p className="text-muted-foreground">
                                We implement industry-standard security measures to protect your data:
                            </p>
                            <ul className="space-y-2 text-muted-foreground mt-4">
                                <li>• All data transfers are encrypted using HTTPS/TLS</li>
                                <li>• Files are processed in isolated, secure environments</li>
                                <li>• Temporary files are automatically purged after processing</li>
                            </ul>
                        </section>

                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-4">
                                <Mail className="w-5 h-5 text-cyan-600" />
                                <h2 className="text-xl font-semibold m-0">Contact Us</h2>
                            </div>
                            <p className="text-muted-foreground">
                                If you have any questions about this Privacy Policy, please contact us at:
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

export default PrivacyPolicy;
