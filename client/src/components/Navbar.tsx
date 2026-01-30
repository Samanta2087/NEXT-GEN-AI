import { memo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
    Music,
    Download,
    Wrench,
    Menu,
    X,
    Sparkles,
    Home,
    Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDevice } from "@/hooks/useDevice";

interface NavItem {
    path: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
    gradient: string;
    activeColor: string;
}

const navItems: NavItem[] = [
    {
        path: "/",
        label: "Home",
        icon: <Home className="w-4 h-4" />,
        gradient: "from-cyan-500 to-blue-500",
        activeColor: "text-cyan-600",
    },
    {
        path: "/downloader",
        label: "Downloader",
        icon: <Download className="w-4 h-4" />,
        gradient: "from-purple-500 to-pink-500",
        activeColor: "text-purple-600",
    },
    {
        path: "/tools",
        label: "Tools",
        icon: <Wrench className="w-4 h-4" />,
        badge: "NEW",
        gradient: "from-blue-500 to-indigo-500",
        activeColor: "text-blue-600",
    },
];

export const Navbar = memo(function Navbar() {
    const [location] = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { isMobile, prefersReducedMotion } = useDevice();

    // Track scroll position for navbar styling
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Close mobile menu when location changes
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location]);

    const isActive = (path: string) => {
        if (path === "/") return location === "/";
        return location.startsWith(path);
    };

    return (
        <>
            <motion.nav
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled || isMobileMenuOpen
                    ? "bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20"
                    : "bg-transparent"
                    }`}
            >
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href="/">
                            <motion.div
                                className="flex items-center gap-2 cursor-pointer group"
                                whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                                whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                            >
                                <div className="relative">
                                    <img
                                        src="/favicon.png"
                                        alt="Grabnex Logo"
                                        className="w-10 h-10 rounded-xl shadow-lg hover:rotate-12 transition-transform duration-300"
                                    />
                                    <motion.div
                                        className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-lime-400 border-2 border-white"
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />
                                </div>
                                <div className="hidden sm:block">
                                    <h1 className="font-bold text-lg bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                                        Grabnex
                                    </h1>
                                    <p className="text-[10px] text-muted-foreground -mt-0.5">Media Studio</p>
                                </div>
                            </motion.div>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => (
                                <Link key={item.path} href={item.path}>
                                    <motion.div
                                        className={`relative px-4 py-2 rounded-xl cursor-pointer transition-all duration-200 ${isActive(item.path)
                                            ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                                            : "hover:bg-gray-100/80 text-gray-600 hover:text-gray-900"
                                            }`}
                                        whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                                        whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                                    >
                                        <div className="flex items-center gap-2">
                                            {item.icon}
                                            <span className="font-medium text-sm">{item.label}</span>
                                            {item.badge && (
                                                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${isActive(item.path)
                                                    ? "bg-white/30 text-white"
                                                    : "bg-blue-100 text-blue-600"
                                                    }`}>
                                                    {item.badge}
                                                </span>
                                            )}
                                        </div>

                                        {isActive(item.path) && !prefersReducedMotion && (
                                            <motion.div
                                                layoutId="activeNavIndicator"
                                                className="absolute inset-0 rounded-xl bg-gradient-to-r opacity-0"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.2 }}
                                            />
                                        )}
                                    </motion.div>
                                </Link>
                            ))}
                        </div>

                        {/* Security Badge - Desktop */}
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                                <Shield className="w-3.5 h-3.5 text-green-600" />
                                <span className="text-xs font-medium text-green-700">Secure</span>
                            </div>
                        </div>

                        {/* Mobile Menu Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="md:hidden"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            <AnimatePresence mode="wait">
                                {isMobileMenuOpen ? (
                                    <motion.div
                                        key="close"
                                        initial={{ rotate: -90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: 90, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="menu"
                                        initial={{ rotate: 90, opacity: 0 }}
                                        animate={{ rotate: 0, opacity: 1 }}
                                        exit={{ rotate: -90, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Menu className="w-5 h-5" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Button>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                            className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100"
                        >
                            <div className="container mx-auto px-4 py-4 space-y-2">
                                {navItems.map((item, index) => (
                                    <motion.div
                                        key={item.path}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <Link href={item.path}>
                                            <div
                                                className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${isActive(item.path)
                                                    ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg`
                                                    : "hover:bg-gray-100 text-gray-600"
                                                    }`}
                                            >
                                                {item.icon}
                                                <span className="font-medium">{item.label}</span>
                                                {item.badge && (
                                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isActive(item.path)
                                                        ? "bg-white/30 text-white"
                                                        : "bg-blue-100 text-blue-600"
                                                        }`}>
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}

                                {/* Mobile Security Badge */}
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: navItems.length * 0.1 }}
                                    className="flex items-center gap-2 px-4 py-3 mt-4 rounded-xl bg-green-50 border border-green-200"
                                >
                                    <Shield className="w-4 h-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700">Secure & Protected</span>
                                    <Sparkles className="w-3 h-3 text-green-500 ml-auto" />
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.nav>

            {/* Spacer to prevent content from going under fixed navbar */}
            <div className="h-16" />
        </>
    );
});

export default Navbar;
