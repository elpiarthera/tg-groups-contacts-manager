import React from 'react';
import { supabase } from '@/lib/apiUtils';

const GroupsList = async () => {
  const { data: groups, error } = await supabase.from('groups').select('*');

  if (error) {
    console.error('Error fetching groups:', error);
    return <div>Error loading groups</div>;
  }

  return (
    <div>
      <h1>Groups List</h1>
      <ul>
        {groups.map((group) => (
          <li key={group.id}>{group.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default GroupsList;