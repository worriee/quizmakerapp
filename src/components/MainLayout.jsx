import React, { useState, useRef, useEffect } from 'react';

const MainLayout = ({
  user,
  children,
  onNewChat,
  onLogout,
  sessions = [],
  onLoadSession,
  currentSessionId,
  onDeleteSession,
  onRenameSession,
  onTogglePin,
  saveStatus = 'synced',
  onRetrySave
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (e, sessionId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === sessionId ? null : sessionId);
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    onDeleteSession(sessionId);
    setOpenMenuId(null);
  };

  const startRename = (e, session) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.topic);
    setOpenMenuId(null);
  };

  const submitRename = (e, sessionId) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e, sessionId) => {
    if (e.key === 'Enter') {
      submitRename(e, sessionId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">Recent Chats</p>
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <p className="text-sm text-gray-400 italic">No recent chats</p>
              </div>
            ) : (
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onLoadSession(session.id)}
                    className={`group relative w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer flex items-center justify-between ${
                      currentSessionId === session.id
                        ? 'bg-indigo-100 text-indigo-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {currentSessionId === session.id && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-r-full" />
                    )}
                    {editingId === session.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, session.id)}
                        onBlur={(e) => submitRename(e, session.id)}
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-gray-800 z-20"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center gap-1 relative z-10 truncate block flex-1 pr-2">
                        {session.pinned && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 text-indigo-500 shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.224A1.2 1.2 0 0116.125 5.625c.134.195.326.347.56.44a6.258 6.258 0 015.087 5.087c.093.234.245.426.44.56a1.2 1.2 0 01.44 1.2v8.25a1.2 1.2 0 01-1.2 1.2h-3.5a1.2 1.2 0 01-1.2-1.2v-4.5a1.2 1.2 0 00-1.2-1.2h-3a1.2 1.2 0 00-1.2 1.2v4.5a1.2 1.2 0 01-1.2 1.2h-3.5a1.2 1.2 0 01-1.2-1.2v-8.25a1.2 1.2 0 01.44-1.2c.194-.114.386-.266.56-.44a6.258 6.258 0 015.087-5.087c.093-.234.245-.426.44-.56a1.2 1.2 0 011.2-.44z" />
                          </svg>
                        )}
                        <span className="truncate">{session.topic}</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => toggleMenu(e, session.id)}
                      className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-300 transition-all z-10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                      </svg>
                    </button>
                    {openMenuId === session.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-2 top-8 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1"
                      >
                        <button
                          onClick={(e) => startRename(e, session)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 17.25l.53-1.625a4.5 4.5 0 011.13-1.897l8.875-8.875z" />
                          </svg>
                          Rename
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, session.id)}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.244H7.632a2.25 2.25 0 01-2.244-2.244L5.08 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.661-.897-3.384-3.586-3.384H6.286c-1.661 0-3.384.723-3.384 3.384v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-200 relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-3 px-2 py-2 w-full rounded-lg hover:bg-gray-200 cursor-pointer transition-all text-left"
            >
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-medium truncate">{user?.email || 'User'}</span>
            </button>

            {isProfileOpen && (
              <div
                ref={profileRef}
                className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">User Profile</h3>
                    <button
                      onClick={() => setIsProfileOpen(false)}
                      className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="text-gray-400 text-[10px] uppercase font-semibold mb-1">Email Address</p>
                      <p className="text-gray-800 font-medium truncate">{user?.email || 'Not available'}</p>
                    </div>
                    
                    <button
                      onClick={onLogout}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all text-sm font-semibold border border-red-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3.375-3.375a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5a.75.75 0 01.75-.75z" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          <div className="ml-4 flex items-center gap-4">
            <span className="font-semibold">Quiz Maker</span>
            
            {saveStatus !== 'synced' && (
              <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                saveStatus === 'saving'
                  ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  : 'bg-red-100 text-red-700 border border-red-200'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                {saveStatus === 'saving' ? (
                  <span>Saving...</span>
                ) : (
                  <button
                    onClick={onRetrySave}
                    className="hover:underline font-bold"
                  >
                    Sync Error! Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
