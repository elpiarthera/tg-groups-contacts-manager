'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function ContactsList() {
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchContacts()
  }, [page])

  const fetchContacts = async () => {
    setIsLoading(true)
    const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))
    
    try {
      const response = await fetch('/api/fetch-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          extractType: 'contacts',
          page,
          pageSize: 50,
          userId: 'tempUserId', // Replace with actual user ID when auth is implemented
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch contacts')
      }

      const data = await response.json()
      setContacts(prevContacts => [...prevContacts, ...data.extractedData])
      setTotalCount(data.totalCount)
      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Error fetching contacts:', error)
      setError('Failed to load contacts. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectAll = () => {
    setSelectAll(!selectAll)
    setSelectedContacts(selectAll ? [] : contacts.map(contact => contact.id))
  }

  const handleSelectContact = (contactId) => {
    setSelectedContacts(prevSelected =>
      prevSelected.includes(contactId)
        ? prevSelected.filter(id => id !== contactId)
        : [...prevSelected, contactId]
    )
  }

  const handleLoadMore = () => {
    if (hasMore) {
      setPage(prevPage => prevPage + 1)
    }
  }

  const handleExtract = async () => {
    const selectedData = contacts.filter(contact => selectedContacts.includes(contact.id))
    const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))

    try {
      const response = await fetch('/api/extract-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...credentials,
          extractType: 'contacts',
          selectedIds: selectedContacts,
          userId: 'tempUserId', // Replace with actual user ID when auth is implemented
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to extract data')
      }

      const data = await response.json()
      // Trigger CSV download
      const blob = new Blob([data.csv], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'extracted_contacts.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error extracting data:', error)
      setError('Failed to extract contacts. Please try again.')
    }
  }

  return (
    <div className="container mx-auto py-10">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Contacts List</h2>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="select-all"
            checked={selectAll}
            onCheckedChange={handleSelectAll}
          />
          <label htmlFor="select-all" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {selectAll ? "Unselect All" : "Select All"}
          </label>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Select</TableHead>
              <TableHead>Avatar</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Bio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bot</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => handleSelectContact(contact.id)}
                  />
                </TableCell>
                <TableCell>
                  <Avatar>
                    <AvatarImage src={contact.profile_photo_url} alt={contact.first_name} />
                    <AvatarFallback>{contact.first_name[0]}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
                <TableCell>{contact.username}</TableCell>
                <TableCell>{contact.phone_number}</TableCell>
                <TableCell>{contact.bio}</TableCell>
                <TableCell>
                  <Badge variant={contact.online_status === 'Online' ? 'success' : 'secondary'}>
                    {contact.online_status}
                  </Badge>
                </TableCell>
                <TableCell>{contact.is_bot ? 'Yes' : 'No'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasMore && (
        <Button onClick={handleLoadMore} className="mt-4">
          Load More
        </Button>
      )}
      <Button onClick={handleExtract} className="mt-4 ml-4" disabled={selectedContacts.length === 0}>
        Extract Selected Contacts
      </Button>
      <p className="mt-2">Total Contacts: {totalCount}</p>
    </div>
  )
}