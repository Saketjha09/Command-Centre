import React from 'react'
import { useTaskBoard } from '../../hooks/useTaskBoard'
import { TaskCard } from './TaskCard'
import { KANBAN_COLUMNS, STATUS_LABELS } from '../../types/task'

export function TaskBoard() {
  const { columns, loading, error, isSyncing, moveTask, refetch } = useTaskBoard()

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)] min-h-[600px]">
        {KANBAN_COLUMNS.map((status) => (
          <div key={status} className="flex-shrink-0 w-[280px] bg-[#1a1a1a] rounded-xl p-3">
            <div className="h-6 w-32 bg-[#2e2e2e] rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-[#2e2e2e] rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-100">Task Board</h2>
        
        {isSyncing && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[#2e2e2e] rounded-full text-xs text-blue-400 font-medium animate-pulse border border-blue-500/20">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
            Syncing...
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-sm">⚠️ {error}</span>
          </div>
          <button 
            onClick={refetch}
            className="text-xs px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
          >
            Retry Fetch
          </button>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)] min-h-[600px] scrollbar-thin scrollbar-thumb-[#2e2e2e]">
        {KANBAN_COLUMNS.map((status) => (
          <div 
            key={status} 
            className="flex-shrink-0 w-[280px] flex flex-col bg-[#141414] rounded-xl border border-[#232323]"
          >
            <div className="p-3 flex items-center justify-between border-b border-[#232323] bg-[#1a1a1a] rounded-t-xl sticky top-0 z-10">
              <h3 className="text-sm font-semibold text-gray-300">
                {STATUS_LABELS[status]}
              </h3>
              <span className="text-[10px] bg-[#2e2e2e] text-gray-400 px-2 py-0.5 rounded-full font-bold">
                {columns[status].length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
              {columns[status].length > 0 ? (
                columns[status].map((task) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onMove={moveTask} 
                  />
                ))
              ) : (
                <div className="h-full min-h-[100px] flex items-center justify-center border-2 border-dashed border-[#232323] rounded-lg">
                  <span className="text-[11px] text-gray-600 font-medium italic">No tasks</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
