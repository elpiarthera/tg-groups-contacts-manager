import './global.css'
import { Toaster } from 'react-hot-toast'

export const metadata = {
  title: 'Telegram Groups and Contacts Extractor',
  description: 'Extract Telegram Groups and Contacts easily',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}
