const React = window.React;

export default function PollResults({ results, totalVotes, options }) {
  if (totalVotes === 0) {
    return <p className="text-sm text-gray-500 italic mt-4">No votes yet.</p>;
  }
  return (
    <div className="mt-6 space-y-3">
      <h4 className="font-medium text-gray-700">Results ({totalVotes} total votes):</h4>
      {options.map(option => {
        const count = results[option] || 0;
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
        return (
          <div key={option} className="result-bar-bg">
            <span className="result-label">{option}</span>
            <div className="result-bar" style={{ width: `${percentage}%` }}>
              <span className="result-percentage">{percentage}%</span>&nbsp;({count})
            </div>
          </div>
        );
      })}
    </div>
  );
} 