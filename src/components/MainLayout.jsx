import { useState, useRef, useEffect } from 'react';

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

  // Helper component for session items
  const SessionItem = ({ session }) => {
    const isActive = currentSessionId === session.id;
    const isEditing = editingId === session.id;

    return (
      <div
        onClick={() => onLoadSession(session.id)}
        className={`group relative w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer flex items-center justify-between ${
           isActive ? 'bg-[#7b9acc] text-white font-bold' : 'text-black hover:bg-[#7b9acc]/10'
        }`}
      >
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#FCF6F5] rounded-r-full opacity-50" />
        )}
        
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, session.id)}
            onBlur={(e) => submitRename(e, session.id)}
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-[#7b9acc]/30 rounded-lg focus:outline-none              focus:ring-2 focus:ring-[#7b9acc] bg-[#FCF6F5] text-black z-20"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <div className="flex items-center gap-2 truncate flex-1">
              {session.pinned && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3 text-[#7b9acc] shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.224A1.2 1.2 0 0116.125 5.625c.134.195.326.347.56.44a6.258 6.258 0 015.087 5.087c.093.234.245.426.44.56a1.2 1.2 0 01.44 1.2v8.25a1.2 1.2 0 01-1.2 1.2h-3.5a1.2 1.2 0 01-1.2-1.2v-4.5a1.2 1.2 0 00-1.2-1.2h-3a1.2 1.2 0 00-1.2 1.2v4.5a1.2 1.2 0 01-1.2 1.2h-3.5a1.2 1.2 0 01-1.2-1.2v-8.25a1.2 1.2 0 01.44-1.2c.194-.114.386-.266.56-.44a6.258 6.258 0 015.087-5.087c.093-.234.245-.426.44-.56a1.2 1.2 0 011.2-.44z" />
                </svg>
              )}
              <span className="truncate">{session.topic}</span>
            </div>
            <button
              onClick={(e) => toggleMenu(e, session.id)}
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[#7b9acc]/10 transition-all z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
            </button>
          </>
        )}

        {openMenuId === session.id && (
          <div
            ref={menuRef}
            className="absolute right-2 top-8 w-32 bg-[#FCF6F5] border border-[#7b9acc]/20 rounded-lg shadow-lg z-50 py-1"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(session.id, session.pinned);
              }}
              className="w-full text-left px-3 py-2 text-sm text-black hover:bg-[#7b9acc]/10 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.649 4.351 15.651 2.351a.75.75 0 00-1.061 0L12 4.724l-3.335-2.373a.75.75 0 00-1.061 0L4.351 4.351a.75.75 0 000 1.061l1.293 1.293a.75.75 0 001.061 0L7.5 6.149V15a2.25 2.25 0 002.25 2.25h5.5a2.25 2.25 0 002.25-2.25V6.149l1.293-1.293a.75.75 0 000-1.061z" />
              </svg>
              {session.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={(e) => startRename(e, session)}
              className="w-full text-left px-3 py-2 text-sm text-black hover:bg-[#7b9acc]/10 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 17.25l.53-1.625a4.5 4.5 0 011.13-1.897l8.875-8.875z" />
              </svg>
              Rename
            </button>
            <button
              onClick={(e) => handleDelete(e, session.id)}
              className="w-full text-left px-3 py-2 text-sm text-black font-bold hover:bg-[#7b9acc]/20 flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.244H7.632a2.25 2.25 0 01-2.244-2.244L5.08 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.661-.897-3.384-3.586-3.384H6.286c-1.661 0-3.384.723-3.384 3.384v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
     <div className="flex h-screen bg-[#FCF6F5] text-black overflow-hidden relative">
      {/* Mobile Overlay Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
className={`fixed inset-y-0 left-0 z-50 bg-[#FCF6F5] border-r border-[#7b9acc]/20 transition-all duration-300 ease-in-out flex flex-col ${
           isSidebarOpen ? 'w-64 translate-x-0' : 'w-64 -translate-x-full'
         } lg:relative lg:w-64 ${!isSidebarOpen ? 'lg:hidden' : 'lg:block'}`}
      >
        <div className="p-4 flex flex-col h-full">
          <button
            onClick={onNewChat}
             className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7b9acc] text-white rounded-full hover:opacity-90 transition-all font-medium text-sm shadow-sm mb-8"
          >
            <span className="text-lg">+</span> New Chat
          </button>

          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Pinned Sessions */}
            <div>
              <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest mb-2 px-2">Pinned</p>
              <div className="space-y-1">
                {sessions.filter(s => s.pinned).length === 0 ? (
                  <p className="text-xs text-black/40 italic px-2">No pinned chats</p>
                ) : (
                  sessions.filter(s => s.pinned).map(session => (
                    <SessionItem key={session.id} session={session} />
                  ))
                )}
              </div>
            </div>

            {/* Recent Sessions */}
            <div>
              <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest mb-2 px-2">Recent</p>
              <div className="space-y-1">
                {sessions.filter(s => !s.pinned).length === 0 ? (
                  <p className="text-xs text-black/40 italic px-2">No recent chats</p>
                ) : (
                  sessions.filter(s => !s.pinned).map(session => (
                    <SessionItem key={session.id} session={session} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#7b9acc]/20">
            {/* User profile removed from here */}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#7b9acc]/20 bg-[#FCF6F5]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#7b9acc]/10 rounded-lg transition-all"
            >
              <span className="text-xl">☰</span>
            </button>
             <span className="font-bold text-lg tracking-tight text-black">TUON AI</span>
          </div>
          
          <div className="flex items-center gap-4">
            {saveStatus !== 'synced' && (
              <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                saveStatus === 'saving'
                  ? 'bg-[#FCF6F5] text-[#7b9acc] border border-[#7b9acc]/30'
                  : 'bg-[#FCF6F5] text-[#7b9acc] border border-[#7b9acc]/30'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === 'saving' ? 'bg-[#7b9acc] animate-pulse' : 'bg-[#7b9acc]'
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

            <button
onMouseDown={(e) => {
               e.stopPropagation();
               setIsProfileOpen(!isProfileOpen);
             }}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-[#7b9acc]/10 transition-all cursor-pointer"
            >
               <div className="w-8 h-8 bg-[#7b9acc] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </button>
            
            {isProfileOpen && (
              <div
                ref={profileRef}
                className="absolute right-4 top-16 w-64 bg-[#FCF6F5] border border-[#7b9acc]/20 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2"
              >
                <div className="p-5">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-[10px] font-black text-black/50 uppercase tracking-widest">User Profile</h3>
                    <button
                      onClick={() => setIsProfileOpen(false)}
                      className="p-1 hover:bg-[#7b9acc]/10 rounded-full transition-colors text-black hover:text-[#7b9acc]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="text-black/60 text-[10px] uppercase font-bold tracking-wider mb-1">Email Address</p>
                      <p className="text-black font-semibold truncate">{user?.email || 'Not available'}</p>
                    </div>
                    
                    <button
                      onClick={onLogout}
                      className="w-full mt-6 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FCF6F5] text-black rounded-xl hover:bg-[#7b9acc]/10 transition-all text-sm font-bold border border-[#7b9acc]/30"
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

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
