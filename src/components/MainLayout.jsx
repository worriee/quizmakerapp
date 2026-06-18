import { useState, useRef, useEffect } from "react";
import pinIcon from "../assets/thumbtacks.png";
import renameIcon from "../assets/edit.png";
import deleteIcon from "../assets/delete.png";
import logoutIcon from "../assets/logout.png";

import ModelSelector from "./ModelSelector";

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
  saveStatus = "synced",
  onRetrySave,
  selectedModel,
  setSelectedModel,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
    if (e.key === "Enter") {
      submitRename(e, sessionId);
    } else if (e.key === "Escape") {
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
          isActive
            ? "bg-[#7b9acc] text-white font-bold"
            : "text-black hover:bg-[#7b9acc]/10"
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
                <img src={pinIcon} alt="Pin" className="w-3 h-3 shrink-0" />
              )}
              <span className="truncate">{session.topic}</span>
            </div>
            <button
              onClick={(e) => toggleMenu(e, session.id)}
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-[#7b9acc]/10 transition-all z-10"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                />
              </svg>
            </button>
          </>
        )}

        {openMenuId === session.id && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full w-40 bg-[#FCF6F5] border border-[#7b9acc]/20 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(session.id, session.pinned);
              }}
              className="w-full text-left px-3 py-2 text-sm text-black/80 hover:bg-[#7b9acc]/10 hover:text-black flex items-center gap-3 transition-colors"
            >
              <img src={pinIcon} alt="Pin" className="w-4 h-4 opacity-70" />
              {session.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={(e) => startRename(e, session)}
              className="w-full text-left px-3 py-2 text-sm text-black/80 hover:bg-[#7b9acc]/10 hover:text-black flex items-center gap-3 transition-colors"
            >
              <img
                src={renameIcon}
                alt="Rename"
                className="w-4 h-4 opacity-70"
              />
              Rename
            </button>
            <div className="my-1 border-t border-[#7b9acc]/10" />
            <button
              onClick={(e) => handleDelete(e, session.id)}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
              <img
                src={deleteIcon}
                alt="Delete"
                className="w-4 h-4 opacity-80"
              />
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
          isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"
        } lg:relative lg:w-64 ${!isSidebarOpen ? "lg:hidden" : "lg:block"}`}
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
              <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest mb-2 px-2">
                Pinned
              </p>
              <div className="space-y-1">
                {sessions.filter((s) => s.pinned).length === 0 ? (
                  <p className="text-xs text-black/40 italic px-2">
                    No pinned chats
                  </p>
                ) : (
                  sessions
                    .filter((s) => s.pinned)
                    .map((session) => (
                      <SessionItem key={session.id} session={session} />
                    ))
                )}
              </div>
            </div>

            {/* Recent Sessions */}
            <div>
              <p className="text-[10px] font-bold text-black/50 uppercase tracking-widest mb-2 px-2">
                Recent
              </p>
              <div className="space-y-1">
                {sessions.filter((s) => !s.pinned).length === 0 ? (
                  <p className="text-xs text-black/40 italic px-2">
                    No recent chats
                  </p>
                ) : (
                  sessions
                    .filter((s) => !s.pinned)
                    .map((session) => (
                      <SessionItem key={session.id} session={session} />
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#7b9acc]/20" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#7b9acc]/20 bg-[#FCF6F5] relative">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 sm:p-2 hover:bg-[#7b9acc]/10 rounded-lg transition-all"
            >
              <span className="text-xl">☰</span>
            </button>
            <span className="font-bold text-lg tracking-tight text-black">
              TUON AI
            </span>
            <span className="text-xs font-medium text-[#7b9acc] border border-[#7b9acc]/40 bg-[#7b9acc]/10 rounded-full px-2.5 py-0.5">
              v1.0.0
            </span>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
            />
          </div>

          <div className="flex items-center gap-4">
            {saveStatus !== "synced" && (
              <div
                className={`flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                  saveStatus === "saving"
                    ? "bg-[#FCF6F5] text-[#7b9acc] border border-[#7b9acc]/30"
                    : "bg-[#FCF6F5] text-[#7b9acc] border border-[#7b9acc]/30"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    saveStatus === "saving"
                      ? "bg-[#7b9acc] animate-pulse"
                      : "bg-[#7b9acc]"
                  }`}
                />
                {saveStatus === "saving" ? (
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
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
            </button>

            {isProfileOpen && (
              <div
                ref={profileRef}
                className="absolute right-4 top-16 w-64 bg-[#FCF6F5] border border-[#7b9acc]/20 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2"
              >
                <div className="p-5">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="text-[10px] font-black text-black/50 uppercase tracking-widest">
                      User Profile
                    </h3>
                    <button
                      onClick={() => setIsProfileOpen(false)}
                      className="p-1 hover:bg-[#7b9acc]/10 rounded-full transition-colors text-black hover:text-[#7b9acc]"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm">
                      <p className="text-black/60 text-[10px] uppercase font-bold tracking-wider mb-1">
                        Email Address
                      </p>
                      <p className="text-black font-semibold truncate">
                        {user?.email || "Not available"}
                      </p>
                    </div>

                    <button
                      onClick={onLogout}
                      className="w-full mt-6 flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FCF6F5] text-black rounded-xl hover:bg-[#7b9acc]/10 transition-all text-sm font-bold border border-[#7b9acc]/30"
                    >
                      <img
                        src={logoutIcon}
                        alt="Logout"
                        className="w-4 h-4 opacity-70"
                      />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">{children}</div>
      </main>
    </div>
  );
};

export default MainLayout;
