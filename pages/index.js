import TelegramManager from '@/components/TelegramManager'

export default function Home() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Telegram Groups and Contacts Extractor</h1>
      <p className="text-center text-lg mb-10">
        Easily manage and extract data from your Telegram groups and contacts.
      </p>
      <TelegramManager />
    </div>
  )
}
