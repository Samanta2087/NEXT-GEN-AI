import { memo } from "react";
import { Link } from "wouter";
import {
    Music,
    Heart,
    Mail,
    Shield,
    Zap
} from "lucide-react";
import { SiInstagram, SiFacebook } from "react-icons/si";

interface FooterLink {
    label: string;
    href: string;
    external?: boolean;
}

const productLinks: FooterLink[] = [
    { label: "Video to MP3", href: "/" },
    { label: "Downloader", href: "/downloader" },
    { label: "Image Tools", href: "/tools" },
];

const legalLinks: FooterLink[] = [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
];

const socialLinks = [
    { icon: Mail, href: "mailto:samantas6085@gmail.com", label: "Email" },
    { icon: SiInstagram, href: "https://www.instagram.com/samanta_18_25?igsh=MTFsbzh1dzBpbjY3cw==", label: "Instagram" },
    { icon: SiFacebook, href: "https://www.facebook.com/share/1AZk2WkxyN/", label: "Facebook" },
];

export const Footer = memo(function Footer() {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="relative mt-auto border-t border-gray-200/50 bg-gradient-to-b from-white to-gray-50/50">
            {/* Decorative gradient */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px"
                style={{
                    background: "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.3), transparent)"
                }}
            />

            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand Section */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Music className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                                    Grabnex
                                </h3>
                                <p className="text-xs text-muted-foreground">Media Studio</p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md mb-4">
                            Professional video to audio conversion with studio-grade quality.
                            Transform your media files quickly and securely.
                        </p>
                        <div className="flex items-center gap-4">
                            {socialLinks.map((social) => (
                                <a
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors group"
                                    aria-label={social.label}
                                >
                                    <social.icon className="w-4 h-4 text-gray-600 group-hover:text-gray-900" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Product Links */}
                    <div>
                        <h4 className="font-semibold text-sm text-gray-900 mb-4">Products</h4>
                        <ul className="space-y-2">
                            {productLinks.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href}>
                                        <span className="text-sm text-muted-foreground hover:text-gray-900 transition-colors cursor-pointer">
                                            {link.label}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div>
                        <h4 className="font-semibold text-sm text-gray-900 mb-4">Legal</h4>
                        <ul className="space-y-2">
                            {legalLinks.map((link) => (
                                <li key={link.href}>
                                    <Link href={link.href}>
                                        <span className="text-sm text-muted-foreground hover:text-gray-900 transition-colors cursor-pointer">
                                            {link.label}
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-12 pt-6 border-t border-gray-200/50">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-green-600" />
                                <span>Secure & Encrypted</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-yellow-600" />
                                <span>Lightning Fast</span>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            © {currentYear} Grabnex. Made with
                            <Heart className="w-3 h-3 text-red-500 fill-red-500" />
                            for creators worldwide.
                        </p>
                    </div>
                </div>
            </div>
        </footer>
    );
});

export default Footer;
