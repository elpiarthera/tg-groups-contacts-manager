'use client'

import TelegramManager from '../components/TelegramManager';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 md:p-24">
      <h1 className="text-3xl sm:text-4xl font-bold mb-8">Telegram Extractor</h1>
      <TelegramManager />
    </main>
  )
}
