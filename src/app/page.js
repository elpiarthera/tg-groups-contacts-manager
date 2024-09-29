'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import TelegramManager from '@/components/TelegramManager'

export default function Home() {
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        const { data, error } = await supabase.from('contacts').select('count', { count: 'exact' })
        if (error) throw error
        console.log('Supabase connection successful')
        setIsLoading(false)
      } catch (error) {
        console.error('Error connecting to Supabase:', error)
        setErrorMessage('Failed to connect to the database. Please try again later.')
        setIsLoading(false)
      }
    }

    checkSupabaseConnection()
  }, [])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (errorMessage) {
    return <div>Error: {errorMessage}</div>
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <TelegramManager />
    </main>
  )
}
