'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from 'lucide-react';
import { API_BASE_URL } from '@/utils/config';
import GroupsList from './GroupsList';
import ContactsList from './ContactsList';

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [showPhoneCodeInput, setShowPhoneCodeInput] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [step, setStep] = useState('credentials'); // 'credentials', 'selection', 'extraction'
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/fetch-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId,
          apiHash,
          phoneNumber,
          extractType,
          page,
          pageSize: 50,
          userId: 'tempUserId', // Replace with actual user ID when auth is implemented
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await response.json();
      
      // Store credentials in localStorage
      localStorage.setItem('telegramCredentials', JSON.stringify({ apiId, apiHash, phoneNumber }));

      // Redirect to the appropriate page
      window.location.href = extractType === 'groups' ? '/groups' : '/contacts';
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message || 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneCodeSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, phoneCode }),
      });
      const data = await response.json();
      if (response.status === 200) {
        setStep('selection');
        setShowPhoneCodeInput(false);
      } else {
        throw new Error(data.error || 'Failed to authenticate');
      }
    } catch (error) {
      console.error('Error authenticating:', error);
      setError(error.message || 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtract = async (selectedIds) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/extract-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, extractType, selectedIds }),
      });
      if (!response.ok) {
        throw new Error('Failed to extract data');
      }
      const data = await response.json();
      setExtractedData(data.extractedData);
      setStep('extraction');
    } catch (error) {
      console.error('Error extracting data:', error);
      setError('Failed to extract data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore) {
      setPage(prevPage => prevPage + 1);
      handleSubmit(new Event('submit'));
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
        <CardDescription>Manage your Telegram groups and contacts ethically</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'credentials' && (
          <>
            <Alert className="mb-6">
              <InfoIcon className="h-4 w-4" />
              <AlertTitle>How to get API ID and API Hash</AlertTitle>
              <AlertDescription>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Go to <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">https://my.telegram.org</a> and log in with your Telegram account.</li>
                  <li>Click on 'API development tools'.</li>
                  <li>Fill in the form with your app details.</li>
                  <li>Click on 'Create application'.</li>
                  <li>You'll see your API ID and API Hash on the next page. Use these in the form below.</li>
                </ol>
                <p className="mt-2"><strong>Note:</strong> Keep your API ID and API Hash private and never share them publicly.</p>
              </AlertDescription>
            </Alert>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-id">API ID</Label>
                <Input
                  id="api-id"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  required
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
                  placeholder="Enter your phone number (with country code)"
                />
              </div>
              <RadioGroup value={extractType} onValueChange={setExtractType}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="groups" id="groups" />
                  <Label htmlFor="groups">Extract Groups</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contacts" id="contacts" />
                  <Label htmlFor="contacts">Extract Contacts</Label>
                </div>
              </RadioGroup>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Fetch Data'}
              </Button>
            </form>
            
            {showPhoneCodeInput && (
              <form onSubmit={handlePhoneCodeSubmit} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone-code">Phone Code</Label>
                  <Input
                    id="phone-code"
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    required
                    placeholder="Enter the code you received"
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </form>
            )}
          </>
        )}

        {step === 'selection' && (
          <>
            <h2 className="text-2xl font-bold mb-4">
              {extractType === 'groups' ? 'Groups' : 'Contacts'} List
            </h2>
            <p className="mb-4">Total: {totalCount}</p>
            {extractType === 'groups' ? <GroupsList groups={groups} /> : <ContactsList contacts={contacts} />}
            {hasMore && (
              <Button onClick={handleLoadMore} className="mt-4">
                Load More
              </Button>
            )}
          </>
        )}

        {step === 'extraction' && extractedData && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold">Extracted Data</h3>
            <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
              {JSON.stringify(extractedData, null, 2)}
            </pre>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}