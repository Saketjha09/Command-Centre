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

interface CommandPaletteProps {
  onAddMember?: () => void
  onAddBrand?: () => void
}

export function CommandPalette({ onAddMember, onAddBrand }: CommandPaletteProps) {
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
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center px-6 py-4 border-b border-gray-100 gap-4">
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, freelancers, or commands..."
            className="flex-1 bg-transparent border-none text-gray-900 placeholder-gray-400 text-lg outline-none font-medium"
          />
          <div className="flex items-center gap-1">
             <span className="px-2 py-1 rounded bg-gray-50 border border-gray-200 text-[10px] text-gray-500 font-bold">ESC</span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3">
          {loading && results.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">Searching across workspace...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left ${
                    index === selectedIndex ? 'bg-indigo-50 border border-indigo-100' : 'border border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                    result.type === 'task' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {result.avatar ? (
                       <img src={result.avatar.startsWith('https') ? result.avatar : `${BASE_URL}${result.avatar}`} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      result.type === 'task' ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      )
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${result.type === 'task' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>{result.type}</span>
                       <h4 className="text-[14px] font-bold text-gray-900 truncate">{result.title}</h4>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">{result.subtitle}</p>
                  </div>
                  {index === selectedIndex && (
                     <div className="text-[10px] text-gray-400 font-bold bg-white px-2 py-1 rounded shadow-sm border border-gray-100 uppercase tracking-widest animate-in fade-in slide-in-from-right-2">Enter to view</div>
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-12 text-center">
               <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <p className="text-sm text-gray-500 font-medium">No results found for "{query}"</p>
            </div>
          ) : (
            <div className="py-6 px-4">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 ml-1">Quick Actions</p>
               <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { setIsOpen(false); navigate('/'); }} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-left hover:border-indigo-600 hover:bg-white transition-all group shadow-sm hover:shadow-md">
                     <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                     </div>
                     <span className="text-[13px] font-bold text-gray-900">Dashboard</span>
                  </button>
                  {onAddMember && (
                    <button onClick={() => { setIsOpen(false); onAddMember(); }} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-left hover:border-indigo-600 hover:bg-white transition-all group shadow-sm hover:shadow-md">
                       <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                       </div>
                       <span className="text-[13px] font-bold text-gray-900">Add Member</span>
                    </button>
                  )}
                  {onAddBrand && (
                    <button onClick={() => { setIsOpen(false); onAddBrand(); }} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-left hover:border-indigo-600 hover:bg-white transition-all group shadow-sm hover:shadow-md">
                       <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                       </div>
                       <span className="text-[13px] font-bold text-gray-900">Add Brand</span>
                    </button>
                  )}
                  <button onClick={() => { setIsOpen(false); navigate('/profile'); }} className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-left hover:border-indigo-600 hover:bg-white transition-all group shadow-sm hover:shadow-md">
                     <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-600 group-hover:bg-gray-600 group-hover:text-white transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     </div>
                     <span className="text-[13px] font-bold text-gray-900">Settings</span>
                  </button>
               </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <div className="flex gap-5">
               <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 shadow-sm text-gray-500">↑↓</span>
                  Navigate
               </div>
               <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <span className="px-1.5 py-0.5 rounded bg-white border border-gray-200 shadow-sm text-gray-500">↵</span>
                  Open
               </div>
            </div>
            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Command Palette v2.0</p>
        </div>
      </div>
    </div>
  )
}
