import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || phoneNumber.trim() === '') {
      setError('Please enter a valid phone number')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    if (!validateInputs()) {
      setIsLoading(false)
      return
    }

    try {
      const payload = {
        apiId: parseInt(apiId),
        apiHash,
        phoneNumber: phoneNumber.trim(),
        extractType,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
      })

      const response = await fetch('/api/telegram-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request')
      }

      if (data.success) {
        if (data.data) {
          alert(`Extracted ${data.data.length} ${extractType}`)
          // Here you might want to save the data or redirect to a results page
          router.push(`/${extractType}-list`)
        } else {
          alert('Extraction completed successfully.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Extract failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Telegram Extractor</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Telegram Extractor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-id">API ID</Label>
              <Input
                id="api-id"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your API ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-hash">API Hash</Label>
              <Input
                id="api-hash"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your API Hash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                disabled={isLoading}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Extract Data'}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
