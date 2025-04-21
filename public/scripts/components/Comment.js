import React from 'react';

export default function Comment({ comment }) {
  return (
    <div className="ml-4 mt-2 p-2 bg-gray-100 rounded text-sm text-gray-700">
      <p>{comment.text}</p>
    </div>
  );
} 