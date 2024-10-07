import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const CODE_EXPIRATION_TIME = 30 * 60; // 30 minutes in seconds

export default function TelegramManager() {
  const router = useRouter()
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [extractType, setExtractType] = useState('groups')
  const [validationCode, setValidationCode] = useState('')
  const [showValidationInput, setShowValidationInput] = useState(false)
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [codeRequestTime, setCodeRequestTime] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(CODE_EXPIRATION_TIME)
  const [isPhoneRegistered, setIsPhoneRegistered] = useState(null)

  useEffect(() => {
    let timer
    if (showValidationInput && codeRequestTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - codeRequestTime) / 1000)
        const remaining = Math.max(CODE_EXPIRATION_TIME - elapsed, 0)
        setTimeRemaining(remaining)
        if (remaining === 0) {
          setError('Code expired. Please request a new one.')
          setShowValidationInput(false)
          setValidationCode('')
          setCodeRequestTime(null)
        }
      }, 1000)
    }
    return () => clearInterval(timer)
  }, [showValidationInput, codeRequestTime])

  const validateInputs = () => {
    if (!apiId || isNaN(apiId) || parseInt(apiId) <= 0) {
      setError('API ID must be a valid positive number')
      return false
    }
    if (!apiHash || !/^[a-f0-9]{32}$/.test(apiHash)) {
      setError('API Hash should be a 32-character hexadecimal string')
      return false
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber.trim())) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)')
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
        validationCode: showValidationInput ? validationCode : undefined,
      }

      console.log('[DEBUG]: Submitting request with:', {
        ...payload,
        apiHash: '******',
        phoneNumber: '*******' + payload.phoneNumber.slice(-4),
        validationCode: payload.validationCode ? '******' : undefined,
      })

      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      console.log('[DEBUG]: Received response:', data)

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to process request')
      }

      if (data.requiresValidation) {
        setShowValidationInput(true)
        setCodeRequestTime(Date.now())
        setTimeRemaining(CODE_EXPIRATION_TIME)
        setIsPhoneRegistered(data.phoneRegistered)
        setError(null)
        alert(`Please enter the validation code sent to your Telegram app. ${data.phoneRegistered ? 'Your phone is registered.' : 'Your phone is not registered and will be signed up.'}`)
      } else if (data.success) {
        if (showValidationInput) {
          setIsAuthenticated(true)
          setShowValidationInput(false)
          setError(null)
          alert('Authentication successful. You can now extract data.')
        } else if (data.data) {
          alert(`Extracted ${data.data.length} ${extractType}`)
          router.push(`/${extractType}-list`)
        }
      } else if (data.code === 'PHONE_CODE_EXPIRED') {
        setError('The verification code has expired. Please request a new code.')
        setShowValidationInput(false)
        setValidationCode('')
        setCodeRequestTime(null)
      } else {
        setError(data.message || 'An unexpected error occurred. Please try again.')
      }
    } catch (error) {
      console.error('[ERROR]: Submit failed:', error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const renderTimer = () => {
    const minutes = Math.floor(timeRemaining / 60)
    const seconds = timeRemaining % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
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
                disabled={isLoading || showValidationInput || isAuthenticated}
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
                disabled={isLoading || showValidationInput || isAuthenticated}
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
                disabled={isLoading || showValidationInput || isAuthenticated}
                placeholder="Enter your phone number (with country code)"
              />
            </div>
            <RadioGroup value={extractType} onValueChange={setExtractType} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="groups" id="groups" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="groups">Extract Groups</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="contacts" id="contacts" disabled={isLoading || !isAuthenticated} />
                <Label htmlFor="contacts">Extract Contacts</Label>
              </div>
            </RadioGroup>
            {showValidationInput && (
              <div className="space-y-2">
                <Label htmlFor="validation-code">Validation Code</Label>
                <Input
                  id="validation-code"
                  value={validationCode}
                  onChange={(e) => setValidationCode(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Enter the code sent to your Telegram app"
                />
                <p className="text-sm text-gray-500">Code expires in: {renderTimer()}</p>
                {isPhoneRegistered !== null && (
                  <p className="text-sm text-blue-500">
                    {isPhoneRegistered ? 'Phone is registered.' : 'Phone is not registered and will be signed up.'}
                  </p>
                )}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                (isAuthenticated ? 'Extract Data' : 
                  (showValidationInput ? 'Verify Code' : 'Request Code'))}
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {isAuthenticated && !error && (
            <Alert className="mt-4">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>You are authenticated. You can now extract data.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
