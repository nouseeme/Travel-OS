import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
const jakarta = localFont({
  src: "../../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-jakarta",
});
export const metadata: Metadata = {
  title: "travelOS · Egimu Travel",
  description:
    "Ruang kerja Egimu Travel untuk lead, perjalanan, pekerjaan, dan pencatatan kas.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f3f4f6",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
