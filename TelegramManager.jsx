'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Ensure this path is correct and that supabase.js is properly set up
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [error, setError] = useState('');

  // Fetch groups or contacts from Supabase
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(''); // Reset error on new submit

    console.log('Extracting:', extractType); // For debugging
    
    try {
      if (extractType === 'groups') {
        // Fetch groups from Supabase
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*');
        
        if (groupsError) throw groupsError;

        console.log('Fetched Groups:', groupsData); // Debugging fetched data
        setGroups(groupsData); // Set groups data from Supabase
      } else {
        // Fetch contacts from Supabase
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('*');
        
        if (contactsError) throw contactsError;

        console.log('Fetched Contacts:', contactsData); // Debugging fetched data
        setGroups(contactsData); // Set contacts as groups for extraction
      }
    } catch (err) {
      console.error('Error fetching data:', err.message);
      setError('Error fetching data from Supabase.'); // Set error for UI
    } finally {
      setIsLoading(false);
    }
  };

  // Generate CSV from selected groups/contacts and trigger download
  const handleExtract = () => {
    setIsLoading(true);

    const selectedItems = groups.filter(group => selectedGroups.includes(group.id));

    const csvContent = selectedItems
      .map(group => `${group.name}, ${group.memberCount || group.phone_number || 'N/A'}`)
      .join("\n");

    const csvBlob = new Blob([csvContent], { type: "text/csv" });
    const csvUrl = URL.createObjectURL(csvBlob);
    setDownloadUrl(csvUrl); // Set the download URL for CSV

    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Telegram Groups and Contacts Manager</CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>How to get API ID and API Hash</AlertTitle>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                Go to{" "}
                <a
                  href="https://my.telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  https://my.telegram.org
                </a>{" "}
                and log in with your Telegram account.
              </li>
              <li>Click on 'API development tools'.</li>
              <li>Fill in the form with your app details.</li>
              <li>Click on 'Create application'.</li>
              <li>
                You'll see your API ID and API Hash on the next page. Use these in
                the form below.
              </li>
            </ol>
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
              placeholder="Enter your phone number (with country code, e.g. +123456789)"
            />
          </div>
          <RadioGroup value={extractType} onValueChange={setExtractType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="groups" id="groups" disabled={isLoading} />
              <Label htmlFor="groups">Extract Groups</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="contacts" id="contacts" disabled={isLoading} />
              <Label htmlFor="contacts">Extract Contacts</Label>
            </div>
          </RadioGroup>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Fetch Data'}
          </Button>
        </form>
        {error && <p className="text-red-500">{error}</p>}
        {groups.length > 0 && (
          <div className="mt-6 space-y-4">
            <h3 className="text-lg font-semibold">Select Groups to Extract</h3>
            {groups.map((group) => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`group-${group.id}`}
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedGroups((prev) => [...prev, group.id]);
                    } else {
                      setSelectedGroups((prev) =>
                        prev.filter((id) => id !== group.id)
                      );
                    }
                  }}
                />
                <Label htmlFor={`group-${group.id}`}>
                  {group.name} ({group.memberCount || 'N/A'} members)
                </Label>
              </div>
            ))}
            <Button
              onClick={handleExtract}
              disabled={isLoading || selectedGroups.length === 0}
            >
              {isLoading ? 'Extracting...' : 'Extract Selected Groups'}
            </Button>
          </div>
        )}
      </CardContent>
      <CardFooter>
        {downloadUrl && (
          <Button asChild>
            <a href={downloadUrl} download="groups_or_contacts.csv">
              Download CSV
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
