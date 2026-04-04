import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import './globals.css'
import { AuthProvider } from '@/components/auth-provider'

export function generateMetadata(): Metadata {
  return {
    title: 'TechRP — Voice AI Training',
    description: 'Voice AI roleplay training for restoration technicians',
    other: {
      ...Sentry.getTraceData()
    }
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}




