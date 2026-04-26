import React, { useState } from 'react'
import type { TaskSummary, TaskStatus } from '../../types/task'
import { KANBAN_COLUMNS } from '../../types/task'
import { TaskComments } from './TaskComments'

interface TaskCardProps {
  task: TaskSummary
  onMove: (taskId: string, newStatus: TaskStatus) => Promise<void>
}

const getBrandColor = (brand: string) => {
  let hash = 0
  for (let i = 0; i < brand.length; i++) {
    hash = brand.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 45%)`
}

const PRIORITY_COLORS = {
  low: '#6b7280',
  medium: '#3b82f6',
  high: '#f59e0b',
  urgent: '#ef4444',
}

export function TaskCard({ task, onMove }: TaskCardProps) {
  const [isMoving, setIsMoving] = useState(false)
  const [showComments, setShowComments] = useState(false)

  const currentIndex = KANBAN_COLUMNS.indexOf(task.status)
  const prevStatus = KANBAN_COLUMNS[currentIndex - 1]
  const nextStatus = KANBAN_COLUMNS[currentIndex + 1]

  const handleMove = async (newStatus: TaskStatus) => {
    setIsMoving(true)
    try {
      await onMove(task.id, newStatus)
    } finally {
      setIsMoving(false)
    }
  }

  const brandColor = getBrandColor(task.brand)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date)
  }

  return (
    <div 
      className={`bg-[#1e1e1e] border border-[#2e2e2e] rounded-lg p-3 mb-3 shadow-sm transition-opacity duration-200 ${isMoving ? 'opacity-50' : 'opacity-100'}`}
      style={{ borderLeft: `4px solid ${brandColor}` }}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-bold text-gray-100 truncate flex-1 mr-2" title={task.title}>
          {task.title}
        </h3>
        <span 
          className="text-[10px] uppercase px-1.5 py-0.5 rounded text-white font-medium"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        >
          {task.priority}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {task.assigned_to_name ? (
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-[#3e3e3e] flex items-center justify-center text-[10px] text-gray-300 font-bold border border-[#4e4e4e]">
                {task.assigned_to_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] text-gray-400">{task.assigned_to_name}</span>
            </div>
          ) : (
            <span className="text-[11px] text-gray-500 italic">Unassigned</span>
          )}
        </div>

        {task.deadline && (
          <span className="text-[11px] text-gray-400 font-medium">
            {formatDate(task.deadline)}
          </span>
        )}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-[#2e2e2e]">
        {prevStatus && (
          <button
            onClick={() => handleMove(prevStatus)}
            disabled={isMoving}
            className="flex-1 text-[11px] py-1 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
        )}
        {nextStatus && (
          <button
            onClick={() => handleMove(nextStatus)}
            disabled={isMoving}
            className="flex-1 text-[11px] py-1 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-gray-300 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Forward →
          </button>
        )}
      </div>

      <div className="mt-3">
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-[11px] text-gray-400 hover:text-gray-200 transition-colors flex items-center gap-1"
        >
          {showComments ? (
            <><span>✕</span> Close</>
          ) : (
            <><span>💬</span> Comments</>
          )}
        </button>

        {showComments && (
          <TaskComments taskId={task.id} darkMode />
        )}
      </div>
    </div>
  )
}
