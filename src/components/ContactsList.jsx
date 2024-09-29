'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default function ContactsList() {
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState([])
  const [selectAll, setSelectAll] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchContacts = async () => {
      const credentials = JSON.parse(localStorage.getItem('telegramCredentials'))
      
      try {
        const response = await fetch('/api/fetch-contacts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch contacts')
        }

        const data = await response.json()
        setContacts(data)
      } catch (error) {
        console.error('Error fetching contacts:', error)
        setError('Failed to load contacts. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchContacts()
  }, [])

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

  const handleExtract = async () => {
    try {
      const response = await fetch('/api/extract-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ selectedContacts }),
      })

      if (!response.ok) {
        throw new Error('Failed to extract contacts')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = 'extracted_contacts.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error extracting contacts:', error)
      setError('Failed to extract contacts. Please try again.')
    }
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="container mx-auto py-10">
      <h2 className="text-2xl font-bold mb-4">Contacts List</h2>
      <Checkbox
        id="select-all"
        checked={selectAll}
        onCheckedChange={handleSelectAll}
        label={selectAll ? "Unselect All" : "Select All"}
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Select</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Bio</TableHead>
            <TableHead>Status</TableHead>
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
              <TableCell>{`${contact.first_name} ${contact.last_name}`}</TableCell>
              <TableCell>{contact.username}</TableCell>
              <TableCell>{contact.phone_number}</TableCell>
              <TableCell>{contact.bio}</TableCell>
              <TableCell>
                <Badge variant={contact.online_status === 'Online' ? 'success' : 'secondary'}>
                  {contact.online_status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button onClick={handleExtract} disabled={selectedContacts.length === 0}>Extract Selected Contacts</Button>
    </div>
  )
}