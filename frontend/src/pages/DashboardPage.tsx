import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { fetchUsers } from '../services/api'
import { fetchWeekAvailability, upsertAvailability } from '../services/availabilityApi'
import { LoadingSpinner } from '../components/LoadingSpinner'
import type { WeekAvailability } from '../types/availability'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const TIME_SLOTS = [
  { id: 'day', label: 'Day', time: '9 AM - 5 PM' },
  { id: 'evening', label: 'Evening', time: '5 PM - 9 PM' },
  { id: 'night', label: 'Night', time: '9 PM - 1 AM' },
] as const;

export function DashboardPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin' || role === 'superadmin'

  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'editors' | 'writers' | 'translators'>('all')

  // Add Freelancer Modal State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', content_type: 'video_edit' })

  // Availability Viewer Modal State
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [userWeek, setUserWeek] = useState<WeekAvailability | null>(null)
  const [loadingWeek, setLoadingWeek] = useState(false)

  // New States for FIX 3
  const [editedSlots, setEditedSlots] = useState<Record<string, Record<string, boolean>>>({})
  const [isSavingSlots, setIsSavingSlots] = useState(false)

  const loadData = () => {
    setLoading(true)
    fetchUsers()
      .then(res => setUsers(res.filter(u => u.role === 'freelancer')))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleLookup = async (user: any) => {
    setSelectedUser(user)
    setLoadingWeek(true)
    setEditedSlots({}) // Reset edited slots
    try {
      const data = await fetchWeekAvailability(user.id, 7)
      setUserWeek(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingWeek(false)
    }
  }

  const handleSlotClick = (date: string, slotId: string, currentAvail: boolean) => {
    setEditedSlots(prev => {
      const dayEdits = prev[date] || {}
      const newAvail = dayEdits[slotId] !== undefined ? !dayEdits[slotId] : !currentAvail
      return { ...prev, [date]: { ...dayEdits, [slotId]: newAvail } }
    })
  }

  const handleSaveSlots = async () => {
    if (!selectedUser) return
    setIsSavingSlots(true)
    try {
      for (const [date, slotsObj] of Object.entries(editedSlots)) {
        const slotsArray = Object.entries(slotsObj).map(([slotId, isAvail]) => ({
          slot: slotId,
          is_available: isAvail
        }))
        if (slotsArray.length > 0) {
          await upsertAvailability(selectedUser.id, date, slotsArray)
        }
      }
      const data = await fetchWeekAvailability(selectedUser.id, 7)
      setUserWeek(data)
      setEditedSlots({})
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingSlots(false)
    }
  }

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const res = await fetch(`${BASE_URL}/api/v1/auth/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: addForm.name, 
          email: addForm.email, 
          password: addForm.password, 
          role: 'freelancer',
          content_type: addForm.content_type
        }),
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to create user')
      setIsAddOpen(false)
      setAddForm({ name: '', email: '', password: '', content_type: 'video_edit' })
      loadData()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredUsers = users.filter(u => {
    if (filter === 'editors') return u.content_type === 'video_edit'
    if (filter === 'writers') return u.content_type === 'script'
    if (filter === 'translators') return u.content_type === 'other'
    return true
  })

  const getCategoryLabel = (contentType: string) => {
    if (contentType === 'video_edit') return 'Editor'
    if (contentType === 'script') return 'Writer'
    if (contentType === 'other') return 'Translator'
    return 'Freelancer'
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 p-10 h-full overflow-y-auto custom-scrollbar bg-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
           <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
           <p className="text-gray-400 text-[13px] font-medium">Manage your team and view availability</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAddOpen(true)}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-bold rounded-xl shadow-md transition-all active:scale-95 w-full sm:w-auto"
          >
            Add Freelancer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-gray-100 pb-4 flex-wrap">
        {[
          { id: 'all', label: 'All Team' },
          { id: 'editors', label: 'Editors' },
          { id: 'writers', label: 'Writers' },
          { id: 'translators', label: 'Translators' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-5 py-2 rounded-full text-[12px] font-bold uppercase tracking-widest transition-all ${
              filter === f.id 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredUsers.length === 0 ? (
           <div className="col-span-full py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
             <p className="text-gray-400 font-medium">No freelancers found in this category.</p>
           </div>
        ) : filteredUsers.map(user => (
          <div 
            key={user.id}
            onClick={() => handleLookup(user)}
            className="flex flex-col gap-4 p-6 bg-white border border-gray-200 rounded-3xl hover:border-gray-400 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-900 font-black text-xl shadow-sm">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className="text-[16px] font-bold text-gray-900 transition-colors">{user.name}</span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{getCategoryLabel(user.content_type)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Availability Modal Viewer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm fade-in">
          <div className="bg-white rounded-3xl w-full max-w-5xl mx-2 sm:mx-4 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-900 font-bold text-lg border border-gray-200">
                   {selectedUser.name?.[0]?.toUpperCase()}
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}'s Schedule</h2>
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{getCategoryLabel(selectedUser.content_type)}</p>
                 </div>
              </div>
              <button onClick={() => { setSelectedUser(null); setEditedSlots({}); }} className="p-2 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto bg-gray-50/30">
               {loadingWeek ? (
                 <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>
               ) : (
                 <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-4 overflow-x-auto">
                   {userWeek?.days.map(day => (
                     <div key={day.date} className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                       <div className="text-center pb-3 border-b border-gray-50">
                         <div className="text-[12px] font-bold text-gray-900 uppercase tracking-widest">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short' })}</div>
                         <div className="text-[10px] text-gray-400 font-bold mt-1 uppercase">{day.date.split('-').slice(1).join('/')}</div>
                       </div>
                       <div className="flex flex-col gap-2">
                         {TIME_SLOTS.map(slotMeta => {
                           const slot = day.slots.find(s => s.slot === slotMeta.id);
                           const originalAvail = slot?.is_available ?? true;
                           const isEdited = editedSlots[day.date]?.[slotMeta.id];
                           const isAvail = isEdited !== undefined ? isEdited : originalAvail;

                           return (
                             <div 
                               key={slotMeta.id} 
                               className="group relative cursor-pointer"
                               onClick={() => handleSlotClick(day.date, slotMeta.id, originalAvail)}
                             >
                               <div className={`w-full h-10 rounded-lg flex items-center justify-center transition-all border ${
                                 isAvail ? 'bg-green-50/50 text-green-600 border-green-100 hover:bg-green-100/50' : 'bg-red-50/50 text-red-500 border-red-100 hover:bg-red-100/50'
                               }`}>
                                 <span className="text-[9px] font-bold uppercase tracking-widest">{slotMeta.label}</span>
                               </div>
                               {slot?.comment && (
                                 <div className="absolute left-1/2 -top-2 -translate-x-1/2 -translate-y-full w-48 p-3 bg-gray-900 text-white rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                                   <p className="text-[10px] font-medium leading-relaxed">"{slot.comment}"</p>
                                   <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900" />
                                 </div>
                               )}
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>

            {Object.keys(editedSlots).length > 0 && (
              <div className="p-6 border-t border-gray-100 bg-white flex justify-end">
                <button 
                  onClick={handleSaveSlots}
                  disabled={isSavingSlots}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  {isSavingSlots ? <LoadingSpinner size="sm" /> : null}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Freelancer Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Add Freelancer</h2>
              <button onClick={() => setIsAddOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 rounded-xl">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Full Name</label>
                <input required type="text" value={addForm.name} onChange={e => setAddForm(f => ({...f, name: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none transition-all text-[14px]" placeholder="John Doe" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Email / Username</label>
                <input required type="email" value={addForm.email} onChange={e => setAddForm(f => ({...f, email: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none transition-all text-[14px]" placeholder="john@example.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <input required type="password" value={addForm.password} onChange={e => setAddForm(f => ({...f, password: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 outline-none transition-all text-[14px]" placeholder="••••••••" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
                <select value={addForm.content_type} onChange={e => setAddForm(f => ({...f, content_type: e.target.value}))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-gray-400 outline-none transition-all text-[14px] bg-white">
                  <option value="video_edit">Editor</option>
                  <option value="script">Writer</option>
                  <option value="other">Translator</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddOpen(false)} className="px-5 py-2.5 text-[13px] font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-[13px] font-bold rounded-xl shadow-md transition-all flex items-center gap-2">
                  {isSubmitting && <LoadingSpinner size="sm" />}
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
