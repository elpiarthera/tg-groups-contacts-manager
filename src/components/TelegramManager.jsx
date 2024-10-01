'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoIcon, Loader2 } from 'lucide-react';

// Remove this line if you don't have a config file
// import { API_BASE_URL } from '@/utils/config';

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [showPhoneCodeInput, setShowPhoneCodeInput] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [csvUrl, setCsvUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, extractType }),
      });

      const data = await response.json();

      if (response.ok) {
        setCsvUrl(data.csvUrl);
        // Handle successful extraction (e.g., show success message, update UI)
      } else {
        throw new Error(data.error || 'Failed to extract data');
      }
    } catch (error) {
      console.error('Error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneCodeSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/fetch-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, phoneCode }),
      });
      const data = await response.json();
      if (response.status === 200) {
        setGroups(data);
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

  const handleExtract = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Replace API_BASE_URL with the actual URL or use a relative path
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiId, apiHash, phoneNumber, extractType, selectedGroups }),
      });
      if (!response.ok) {
        throw new Error('Failed to extract data');
      }
      const data = await response.json();
      setExtractedData(data.extractedData);
      setCsvUrl(data.csvUrl);
    } catch (error) {
      console.error('Error extracting data:', error);
      setError('Failed to extract data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
        <CardDescription>Manage your Telegram groups and contacts ethically</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="extract" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extract">Extract Data</TabsTrigger>
            <TabsTrigger value="account">Account Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="extract">
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
                <Label htmlFor="phone-number">Phone Number (for Telegram API)</Label>
                <Input
                  id="phone-number"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="Enter your phone number (with country code)"
                />
              </div>
              <RadioGroup value={extractType} onValueChange={setExtractType} className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="groups" id="groups" />
                  <Label htmlFor="groups">Extract Groups</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="contacts" id="contacts" />
                  <Label htmlFor="contacts">Extract Contacts</Label>
                </div>
              </RadioGroup>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? 'Fetching...' : 'Fetch Data'}
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
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </form>
            )}

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {groups.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-lg font-semibold">Select Groups to Extract</h3>
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={selectedGroups.includes(group.id)}
                      onCheckedChange={(checked) => {
                        setSelectedGroups(
                          checked
                            ? [...selectedGroups, group.id]
                            : selectedGroups.filter((id) => id !== group.id)
                        );
                      }}
                    />
                    <Label htmlFor={`group-${group.id}`}>
                      {group.name} ({group.memberCount} members)
                    </Label>
                  </div>
                ))}
                <Button onClick={handleExtract} disabled={isLoading || selectedGroups.length === 0} className="w-full">
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isLoading ? 'Extracting...' : 'Extract Selected Groups'}
                </Button>
              </div>
            )}

            {extractedData && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold">Extracted Data</h3>
                <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
                  {JSON.stringify(extractedData, null, 2)}
                </pre>
              </div>
            )}

            {csvUrl && (
              <Button asChild className="mt-4 w-full">
                <a href={csvUrl} download>Download CSV</a>
              </Button>
            )}
          </TabsContent>
          <TabsContent value="account">
            <p>Account settings will be available here.</p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
