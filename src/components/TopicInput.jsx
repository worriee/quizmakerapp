import React, { useState } from 'react';

const TopicInput = ({ onStart }) => {
  const [topic, setTopic] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (topic.trim()) {
      onStart(topic);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <h1 className="text-4xl font-bold mb-6 text-indigo-600">AI Quiz Maker</h1>
      <p className="text-gray-600 mb-8 max-w-md">
        Enter a topic you want to be tested on, and our AI tutor will guide you through a mock exam.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-md flex flex-col gap-4">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Quantum Physics, French Revolution, React Hooks..."
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          required
        />
        <button
          type="submit"
          className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-lg"
        >
          Start Learning
        </button>
      </form>
    </div>
  );
};

export default TopicInput;
