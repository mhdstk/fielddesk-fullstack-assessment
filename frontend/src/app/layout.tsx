import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FieldDesk — Field Service Platform",
  description: "Multi-tenant field service work order management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#fcfcfc]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
