import React, { useState } from 'react';

const MainLayout = ({ children, onNewChat }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-white text-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-gray-50 border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? 'w-64' : 'w-0 -translate-x-full'
        } lg:translate-x-0 lg:relative`}
      >
        <div className="p-4 flex flex-col h-full">
          <button 
            onClick={onNewChat}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-all font-medium text-sm shadow-sm mb-6"
          >
            <span className="text-lg">+</span> New Chat
          </button>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Recent Sessions</p>
            {/* Session history will be mapped here */}
            <div className="text-sm text-gray-500 px-2 italic">No recent chats</div>
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-200 cursor-pointer transition-all">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
              <span className="text-sm font-medium">User Account</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center p-4 border-b border-gray-200 bg-white">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-all"
          >
            <span className="text-xl">☰</span>
          </button>
          <span className="ml-4 font-semibold">Quiz Maker</span>
        </div>
        
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
