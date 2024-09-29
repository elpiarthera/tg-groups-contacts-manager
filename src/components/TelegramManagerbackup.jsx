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

export default function TelegramManager() {
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [extractType, setExtractType] = useState('groups');
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // In a real app, you would make an API call to your backend here
    setGroups([
      { id: 1, name: 'Group 1', memberCount: 100 },
      { id: 2, name: 'Group 2', memberCount: 200 },
      { id: 3, name: 'Group 3', memberCount: 150 },
    ]);
    setIsLoading(false);
  };

  const handleExtract = async () => {
    setIsLoading(true);
    // Simulating API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    // In a real app, you would make an API call to your backend here
    setDownloadUrl('https://example.com/download.csv');
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
        <CardDescription>Manage your Telegram groups and contacts ethically</CardDescription>
      </CardHeader>
      <CardContent>
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
            <Button onClick={handleExtract} disabled={isLoading || selectedGroups.length === 0}>
              {isLoading ? 'Extracting...' : 'Extract Selected Groups'}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {downloadUrl && (
          <Button asChild>
            <a href={downloadUrl} download>Download CSV</a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}