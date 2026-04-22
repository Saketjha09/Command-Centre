import { useState, useEffect, useRef } from 'react'
import { globalSearch } from '../services/api'
import { useNavigate } from 'react-router-dom'

interface SearchResult {
  id: string
  type: 'task' | 'user'
  title: string
  subtitle: string
  avatar?: string
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const { results } = await globalSearch(query)
        setResults(results)
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  function handleSelect(result: SearchResult) {
    setIsOpen(false)
    if (result.type === 'task') {
      navigate('/')
      // Triggering an event or using a store to open the task drawer would be better
      // For now we'll just navigate to home
    } else {
      navigate('/availability')
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length)
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-[#1c2128] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-4 py-4 border-b border-white/5 gap-3">
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, freelancers, or commands..."
            className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-500 text-lg outline-none"
          />
          <div className="flex items-center gap-1">
             <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-slate-500 font-mono">ESC</span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
          {loading && results.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Searching across workspace...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                    index === selectedIndex ? 'bg-indigo-600/20 border border-indigo-500/20' : 'border border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    result.type === 'task' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    {result.avatar ? (
                       <img src={result.avatar.startsWith('https') ? result.avatar : `${BASE_URL}${result.avatar}`} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      result.type === 'task' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      )
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] font-bold uppercase tracking-widest ${result.type === 'task' ? 'text-indigo-400' : 'text-emerald-400'}`}>{result.type}</span>
                       <h4 className="text-sm font-medium text-slate-200 truncate">{result.title}</h4>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{result.subtitle}</p>
                  </div>
                  {index === selectedIndex && (
                     <div className="text-[10px] text-slate-500 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10 uppercase tracking-tighter">Enter to view</div>
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-12 text-center">
               <p className="text-sm text-slate-500">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-8 px-4">
               <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-4">Quick Commands</p>
               <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => navigate('/')} className="p-3 rounded-xl border border-white/5 bg-[#0d1117] text-left hover:border-indigo-500/30 transition-all">
                     <span className="text-xs font-semibold text-slate-300">Go to Dashboard</span>
                  </button>
                  <button onClick={() => navigate('/profile')} className="p-3 rounded-xl border border-white/5 bg-[#0d1117] text-left hover:border-indigo-500/30 transition-all">
                     <span className="text-xs font-semibold text-slate-300">Update Profile</span>
                  </button>
               </div>
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-[#0d1117] border-t border-white/5 flex justify-between items-center">
            <div className="flex gap-4">
               <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="px-1 py-0.5 rounded bg-white/5 border border-white/10">↑↓</span>
                  Navigate
               </div>
               <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="px-1 py-0.5 rounded bg-white/5 border border-white/10">↵</span>
                  Open
               </div>
            </div>
            <p className="text-[10px] text-slate-600">Command Palette v1.0</p>
        </div>
      </div>
    </div>
  )
}
