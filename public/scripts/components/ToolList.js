const React = window.React;

export default function ToolList({ onSelectTool }) {
  const tools = [
    { id: 'raise-hand', name: 'Raise Hand (Q&A)', description: 'Ask questions, vote, and get answers.' },
    { id: 'poll', name: 'Poll', description: 'Create and participate in live polls.' },
    { id: 'find-teammate', name: 'Find Teammate', description: 'Connect with peers for group projects. (Coming Soon)' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">Professor & Student Tools</h1>
        <div className="space-y-4">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className="w-full text-left p-5 border border-gray-200 rounded-lg hover:bg-gray-100 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
              disabled={!['raise-hand', 'poll'].includes(tool.id)} // Disable unimplemented tools
            >
              <h2 className="text-xl font-semibold text-indigo-700">{tool.name}</h2>
              <p className="text-gray-600 mt-1">{tool.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 