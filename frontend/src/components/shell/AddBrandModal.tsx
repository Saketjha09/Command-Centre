import { useState } from 'react'
import { createBrand } from '../../services/api'
import { LoadingSpinner } from '../LoadingSpinner'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: (brand: any) => void
}

export function AddBrandModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [hexColor, setHexColor] = useState('#6366f1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const brand = await createBrand({ name, slug, hex_color: hexColor })
      onSuccess(brand)
      onClose()
      setName('')
      setSlug('')
      setHexColor('#6366f1')
    } catch (err: any) {
      setError(err.message || 'Failed to create brand')
    } finally {
      setLoading(false)
    }
  }

  const handleNameChange = (val: string) => {
    setName(val)
    setSlug(val.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, ''))
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[110] animate-in fade-in duration-300" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-gray-200 z-[111] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-widest">Register New Brand</h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-xs font-bold uppercase tracking-widest">{error}</div>}
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Display Name</label>
            <input 
              type="text" required placeholder="e.g. Acme Corp"
              value={name} onChange={e => handleNameChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-600 outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">System Identifier</label>
            <input 
              type="text" required readOnly
              value={slug}
              className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-400 cursor-not-allowed outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Brand Palette</label>
            <div className="flex gap-4 items-center">
              <input 
                type="color"
                value={hexColor} onChange={e => setHexColor(e.target.value)}
                className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer p-0 overflow-hidden shadow-sm"
              />
              <input 
                type="text" 
                value={hexColor} onChange={e => setHexColor(e.target.value)}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-mono text-gray-600 uppercase focus:border-indigo-600 outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-100 active:scale-95 flex items-center justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Create Brand Entity'}
          </button>
        </form>
      </div>
    </>
  )
}
