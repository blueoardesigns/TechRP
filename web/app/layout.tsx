import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TechRP Manager Dashboard',
  description: 'Manager dashboard for technician training',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}




