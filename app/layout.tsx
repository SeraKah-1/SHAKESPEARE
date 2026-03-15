import type {Metadata} from 'next';
import { Inter, Merriweather } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const merriweather = Merriweather({ weight: ['300', '400', '700'], subsets: ['latin'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'AI Novel Architect',
  description: 'Sistem AI pembuat novel interaktif dengan ingatan jangka panjang dan kontrol kualitas otonom.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${merriweather.variable} bg-zinc-950 text-zinc-100 min-h-screen flex flex-col font-sans overflow-hidden`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
