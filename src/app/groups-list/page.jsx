'use client'

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import GroupsList from '@/components/GroupsList';

const GroupsListPage = () => {
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const { data, error } = await supabase.from('groups').select('*');
        if (error) throw error;
        setGroups(data);
      } catch (error) {
        console.error('Error fetching groups:', error);
        setError('Failed to load groups. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroups();
  }, []);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-2xl font-bold mb-4">Groups List</h1>
      <GroupsList groups={groups} />
    </div>
  );
};

export default GroupsListPage;
