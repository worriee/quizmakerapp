import { useState, useRef, useEffect } from "react";
import pinIcon from "../assets/thumbtacks.png";
import renameIcon from "../assets/edit.png";
import deleteIcon from "../assets/delete.png";
import logoutIcon from "../assets/logout.png";
import lightIcon from "../assets/light.png";
import darkIcon from "../assets/night-mode.png";
import searchIcon from "../assets/search.png";

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
  customModels = [],
  onSaveCustomModel,
  onDeleteCustomModel,
  theme,
  onToggleTheme,
  onSearchSessions,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 1024 : true,
  );
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [changelog, setChangelog] = useState(null);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const menuRef = useRef(null);
  const profileRef = useRef(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const searchTimerRef = useRef(null);
  const searchInputRef = useRef(null);

  const VERSION = "2.5";

  const hasNewVersion =
    typeof window !== "undefined" &&
    localStorage.getItem("quizmaker_dismissed_version") !== VERSION;

  // Close search dropdown on Escape
  useEffect(() => {
    const handleSearchKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchResults(null);
      }
    };
    if (isSearchOpen) {
      window.addEventListener("keydown", handleSearchKeyDown);
      return () => window.removeEventListener("keydown", handleSearchKeyDown);
    }
  }, [isSearchOpen]);

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      const results = await onSearchSessions(val);
      setSearchResults(results);
    }, 300);
  };

  const handleSearchSelect = (sessionId) => {
    onLoadSession(sessionId);
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchResults(null);
  };

  const handleOpenChangelog = async () => {
    if (changelog) {
      setIsChangelogOpen(true);
      return;
    }
    setChangelogLoading(true);
    try {
      const res = await fetch("/changelog.json");
      const data = await res.json();
      setChangelog(data);
      setIsChangelogOpen(true);
    } catch {
      setChangelog(null);
    } finally {
      setChangelogLoading(false);
    }
  };

  const handleCloseChangelog = () => {
    setIsChangelogOpen(false);
    localStorage.setItem("quizmaker_dismissed_version", VERSION);
  };

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
            : "text-app hover:bg-[#7b9acc]/10"
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
            className="flex-1 px-2 py-1 text-sm border border-app rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7b9acc] bg-app-surface text-app z-20"
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
              className="p-1 rounded-md hover:bg-[#7b9acc]/10 transition-all z-10"
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
            className="absolute right-0 top-full w-40 bg-app-surface border border-app rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(session.id, session.pinned);
              }}
              className="w-full text-left px-3 py-2 text-sm text-app-secondary hover:bg-[#7b9acc]/10 hover:text-app flex items-center gap-3 transition-colors"
            >
              <img src={pinIcon} alt="Pin" className="w-4 h-4 opacity-70" />
              {session.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              onClick={(e) => startRename(e, session)}
              className="w-full text-left px-3 py-2 text-sm text-app-secondary hover:bg-[#7b9acc]/10 hover:text-app flex items-center gap-3 transition-colors"
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
    <div className="flex h-screen bg-app text-app overflow-hidden relative">
      {/* Mobile Overlay Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-app border-r border-app transition-transform duration-300 ease-in-out flex flex-col ${
          isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full"
        } lg:relative lg:w-64 ${!isSidebarOpen ? "lg:hidden" : "lg:block"}`}
      >
        <div className="p-4 flex flex-col h-full">
          <button
            onClick={onNewChat}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7b9acc] text-white rounded-full hover:opacity-90 transition-all font-medium text-sm shadow-sm mb-6"
          >
            New Chat
          </button>

          {/* Search chats */}
          <button
            onClick={() => {
              setIsSearchOpen(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 mb-6 rounded-lg text-sm text-app hover:bg-[#7b9acc]/10 transition-all"
          >
            <img
              src={searchIcon}
              alt="Search"
              className={`w-4 h-4 shrink-0 ${theme === "dark" ? "brightness-0 invert" : ""}`}
            />
            Search chats
          </button>

          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Pinned Sessions */}
            <div>
              <p className="text-[10px] font-bold text-app-muted uppercase tracking-widest mb-2 px-2">
                Pinned
              </p>
              <div className="space-y-1">
                {sessions.filter((s) => s.pinned).length === 0 ? (
                  <p className="text-xs text-app-muted italic px-2">
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
              <p className="text-[10px] font-bold text-app-muted uppercase tracking-widest mb-2 px-2">
                Recent
              </p>
              <div className="space-y-1">
                {sessions.filter((s) => !s.pinned).length === 0 ? (
                  <p className="text-xs text-app-muted italic px-2">
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

      {/* Search Modal */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] sm:pt-[15vh] bg-black/30 backdrop-blur-sm"
          onClick={() => {
            setIsSearchOpen(false);
            setSearchQuery("");
            setSearchResults(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg mx-3 sm:mx-4 bg-app-surface border border-app rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4"
          >
            <div className="p-4 border-b border-app flex items-center gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-5 h-5 text-app-muted shrink-0"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="Search sessions..."
                className="flex-1 bg-transparent text-sm text-app placeholder-app-muted/50 focus:outline-none"
              />
              <button
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                  setSearchResults(null);
                }}
                className="p-1.5 hover:bg-[#7b9acc]/10 rounded-full transition-all text-app/60 hover:text-app shrink-0"
                aria-label="Close search"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-5 h-5"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {!searchResults ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-app-muted">
                    Type at least 2 characters to search
                  </p>
                </div>
              ) : searchResults.titleMatches?.length === 0 &&
                searchResults.contentMatches?.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-app-muted">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              ) : (
                <div className="py-2">
                  {searchResults.titleMatches?.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-app-muted uppercase tracking-wider">
                        Title Matches
                      </div>
                      {searchResults.titleMatches.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSearchSelect(s.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-app hover:bg-[#7b9acc]/10 transition-colors flex items-center gap-3"
                        >
                          {s.pinned && (
                            <span className="text-[10px] text-app-muted">
                              📌
                            </span>
                          )}
                          <span className="truncate">
                            {s.topic || "Untitled"}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.contentMatches?.length > 0 && (
                    <div>
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-app-muted uppercase tracking-wider border-t border-app">
                        Content Matches
                      </div>
                      {searchResults.contentMatches.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleSearchSelect(s.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-app hover:bg-[#7b9acc]/10 transition-colors truncate"
                        >
                          {s.topic || "Untitled"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4 border-b border-app bg-app z-10 relative">
          {/* Left group: hamburger, TUON AI, version */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#7b9acc]/10 rounded-lg transition-all shrink-0"
              aria-label="Toggle sidebar"
            >
              <span className="text-lg sm:text-xl leading-none">☰</span>
            </button>
            <span className="font-bold text-base sm:text-lg tracking-tight text-app whitespace-nowrap">
              TUON AI
            </span>
            <button
              onClick={handleOpenChangelog}
              className="relative text-[10px] sm:text-xs font-medium text-[#7b9acc] border border-[#7b9acc]/40 bg-[#7b9acc]/10 rounded-full px-2 py-0.5 hover:bg-[#7b9acc]/20 transition-all cursor-pointer shrink-0"
            >
              v{VERSION}
              {hasNewVersion && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#7b9acc] border-2 border-[#FCF6F5] rounded-full" />
              )}
            </button>
          </div>

          {/* Model selector - wraps to own row on mobile, centered on desktop */}
          <div className="order-last sm:order-none w-full sm:w-auto sm:flex-1 sm:flex sm:justify-center mt-1 sm:mt-0">
            <ModelSelector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              customModels={customModels}
              onSaveCustomModel={onSaveCustomModel}
              onDeleteCustomModel={onDeleteCustomModel}
            />
          </div>

          {/* Right group: save status, theme toggle, profile */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {saveStatus !== "synced" && (
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all border border-app ${
                  saveStatus === "saving"
                    ? "bg-app text-app-secondary"
                    : "bg-app text-app-secondary"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    saveStatus === "saving"
                      ? "bg-[#7b9acc] animate-pulse"
                      : "bg-[var(--app-error-dot)]"
                  }`}
                />
                <span className="hidden sm:inline">
                  {saveStatus === "saving" ? "Saving..." : "Sync Error"}
                </span>
                {saveStatus === "error" && (
                  <button
                    onClick={onRetrySave}
                    className="sm:ml-0.5 hover:underline font-bold text-app"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-full hover:bg-[#7b9acc]/10 transition-all text-app/70 hover:text-app"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <img
                  src={lightIcon}
                  alt="Light mode"
                  className="w-4 h-4 sm:w-5 sm:h-5 brightness-0 invert"
                />
              ) : (
                <img
                  src={darkIcon}
                  alt="Dark mode"
                  className="w-4 h-4 sm:w-5 sm:h-5"
                />
              )}
            </button>

            <div className="relative">
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsProfileOpen(!isProfileOpen);
                }}
                className="p-1 rounded-full hover:bg-[#7b9acc]/10 transition-all cursor-pointer"
                aria-label="Profile"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#7b9acc] rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </div>
              </button>

              {isProfileOpen && (
                <div
                  ref={profileRef}
                  className="absolute right-0 top-full mt-2 w-64 bg-app-surface border border-app rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="text-[10px] font-black text-app-muted uppercase tracking-widest">
                        User Profile
                      </h3>
                      <button
                        onClick={() => setIsProfileOpen(false)}
                        className="p-1 hover:bg-[#7b9acc]/10 rounded-full transition-colors text-app hover:text-[#7b9acc]"
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
                        <p className="text-app-muted text-[10px] uppercase font-bold tracking-wider mb-1">
                          User Profile
                        </p>
                        <p className="text-app font-semibold truncate">
                          {user?.email || "Not available"}
                        </p>
                      </div>
                      <button
                        onClick={onLogout}
                        className="w-full mt-6 flex items-center justify-center gap-2 px-3 py-2.5 bg-app-surface text-app rounded-xl hover:bg-[#7b9acc]/10 transition-all text-sm font-bold border border-app"
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
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>

        {isChangelogOpen && changelog && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseChangelog}
          >
            <div
              className="bg-app-surface border border-app rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-app-surface border-b border-app px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="font-bold text-lg text-app">What's New</h2>
                  <p className="text-xs text-app-muted">
                    TUON AI Release Notes
                  </p>
                </div>
                <button
                  onClick={handleCloseChangelog}
                  className="p-1.5 hover:bg-[#7b9acc]/10 rounded-full transition-all text-app/60 hover:text-app"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-4 space-y-6">
                {changelog.map((release) => (
                  <div key={release.version}>
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="text-sm font-bold text-[#7b9acc] border border-[#7b9acc]/30 bg-[#7b9acc]/10 rounded-full px-2.5 py-0.5">
                        v{release.version}
                      </span>
                      <span className="text-xs text-app-muted">
                        {release.date}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {release.notes.map((note, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-app-secondary"
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#7b9acc]/40 shrink-0" />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#7b9acc]/10 px-6 py-3">
                <p className="text-[10px] text-app-muted text-center">
                  Thank you for using TUON AI. -Jul
                </p>
              </div>
            </div>
          </div>
        )}

        {changelogLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-app-surface rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#7b9acc] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-app-secondary">
                Loading changelog...
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MainLayout;
