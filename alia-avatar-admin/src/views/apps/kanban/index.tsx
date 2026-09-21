'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  Plus,
  MoreVertical,
  Calendar,
  MessageSquare,
  Paperclip,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react'

export type KanbanTask = {
  id: string
  title: string
  description?: string
  tag: 'UI/UX' | 'Backend' | 'Feature' | 'Bug' | 'DevOps'
  tagColor: string
  dueDate: string
  assignees: { avatar: string; fallback: string }[]
  commentsCount: number
  attachmentsCount: number
  badgeColor?: string
}

export type KanbanColumn = {
  id: string
  title: string
  color: string
  tasks: KanbanTask[]
}

const initialColumns: KanbanColumn[] = [
  {
    id: 'col-1',
    title: 'To Do',
    color: 'bg-primary',
    tasks: [
      {
        id: 't-1',
        title: 'Design Dark Mode tokens & elevation levels',
        description: 'Update color palette variables in globals.css to support dark glassmorphism.',
        tag: 'UI/UX',
        tagColor: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
        dueDate: 'Mar 15',
        assignees: [
          { avatar: '/images/avatars/avatar-1.webp', fallback: 'SC' },
          { avatar: '/images/avatars/avatar-2.webp', fallback: 'MT' }
        ],
        commentsCount: 4,
        attachmentsCount: 2
      },
      {
        id: 't-2',
        title: 'Integrate Stripe Webhooks for subscription billing',
        description: 'Handle customer.subscription.created and charge.failed events.',
        tag: 'Backend',
        tagColor: 'bg-primary/10 text-primary border-primary/20',
        dueDate: 'Mar 18',
        assignees: [{ avatar: '/images/avatars/avatar-3.webp', fallback: 'EC' }],
        commentsCount: 1,
        attachmentsCount: 0
      }
    ]
  },
  {
    id: 'col-2',
    title: 'In Progress',
    color: 'bg-amber-500',
    tasks: [
      {
        id: 't-3',
        title: 'Optimize Recharts bundle size with dynamic imports',
        description: 'Reduce first contentful paint by code-splitting large chart widgets.',
        tag: 'DevOps',
        tagColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
        dueDate: 'Mar 12',
        assignees: [
          { avatar: '/images/avatars/avatar-4.webp', fallback: 'DL' },
          { avatar: '/images/avatars/avatar-5.webp', fallback: 'JA' }
        ],
        commentsCount: 8,
        attachmentsCount: 3
      },
      {
        id: 't-4',
        title: 'Add Export to CSV/PDF in Datatables',
        description: 'Client-side export utility for orders and customer tables.',
        tag: 'Feature',
        tagColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        dueDate: 'Mar 14',
        assignees: [{ avatar: '/images/avatars/avatar-6.webp', fallback: 'SP' }],
        commentsCount: 2,
        attachmentsCount: 1
      }
    ]
  },
  {
    id: 'col-3',
    title: 'Review',
    color: 'bg-purple-500',
    tasks: [
      {
        id: 't-5',
        title: 'Fix authentication session refresh token expiry',
        description: 'Silent token renewal flow when jwt expires before tab focus.',
        tag: 'Bug',
        tagColor: 'bg-destructive/10 text-destructive border-destructive/20',
        dueDate: 'Mar 10',
        assignees: [{ avatar: '/images/avatars/avatar-7.webp', fallback: 'RW' }],
        commentsCount: 6,
        attachmentsCount: 0
      }
    ]
  },
  {
    id: 'col-4',
    title: 'Done',
    color: 'bg-emerald-500',
    tasks: [
      {
        id: 't-6',
        title: 'Avatar management & image asset sync',
        description: 'Download 91 Pro assets into public/images with clean caching.',
        tag: 'Feature',
        tagColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
        dueDate: 'Mar 08',
        assignees: [
          { avatar: '/images/avatars/avatar-8.webp', fallback: 'LM' },
          { avatar: '/images/avatars/avatar-9.webp', fallback: 'KB' }
        ],
        commentsCount: 12,
        attachmentsCount: 5
      }
    ]
  }
]

export const KanbanApp = () => {
  const [columns, setColumns] = useState<KanbanColumn[]>(initialColumns)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [activeColId, setActiveColId] = useState<string | null>(null)

  const handleAddTask = (columnId: string) => {
    if (!newTaskTitle.trim()) return

    const newTask: KanbanTask = {
      id: `t-${Date.now()}`,
      title: newTaskTitle.trim(),
      tag: 'Feature',
      tagColor: 'bg-primary/10 text-primary border-primary/20',
      dueDate: 'Soon',
      assignees: [{ avatar: '/images/avatars/avatar-1.webp', fallback: 'ME' }],
      commentsCount: 0,
      attachmentsCount: 0
    }

    setColumns(prev =>
      prev.map(col => {
        if (col.id === columnId) {
          return { ...col, tasks: [newTask, ...col.tasks] }
        }
        return col
      })
    )

    setNewTaskTitle('')
    setActiveColId(null)
  }

  return (
    <div className='space-y-6'>
      {/* Top action bar */}
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Kanban Board</h1>
          <p className='text-sm text-muted-foreground'>
            Track project milestones, sprint tasks, and team deliverables.
          </p>
        </div>

        <div className='flex items-center gap-2'>
          <Button size='sm' className='gap-1.5 h-9'>
            <Plus className='size-4' /> Add Board
          </Button>
        </div>
      </div>

      {/* Columns Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start'>
        {columns.map(column => (
          <div
            key={column.id}
            className='bg-muted/30 border border-border/70 rounded-2xl p-4 flex flex-col gap-4'
          >
            {/* Column Header */}
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2.5'>
                <span className={`size-2.5 rounded-full ${column.color}`} />
                <h3 className='font-semibold text-sm text-foreground'>{column.title}</h3>
                <span className='size-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold'>
                  {column.tasks.length}
                </span>
              </div>

              <Button variant='ghost' size='icon' className='size-7 text-muted-foreground'>
                <MoreVertical className='size-3.5' />
              </Button>
            </div>

            {/* Quick Add Form */}
            {activeColId === column.id ? (
              <div className='p-3 bg-card border border-border rounded-xl space-y-2'>
                <Input
                  placeholder='Enter task title...'
                  className='text-xs h-8'
                  value={newTaskTitle}
                  autoFocus
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddTask(column.id)
                  }}
                />
                <div className='flex items-center justify-end gap-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 text-xs'
                    onClick={() => setActiveColId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size='sm'
                    className='h-7 text-xs'
                    onClick={() => handleAddTask(column.id)}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant='outline'
                size='sm'
                className='w-full border-dashed border-border/80 text-muted-foreground hover:text-foreground h-9 gap-1.5 text-xs'
                onClick={() => setActiveColId(column.id)}
              >
                <Plus className='size-3.5' /> Add Task
              </Button>
            )}

            {/* Task Cards */}
            <div className='space-y-3'>
              {column.tasks.map(task => (
                <Card
                  key={task.id}
                  className='p-4 bg-card border border-border/60 hover:border-border hover:shadow-xs transition-all cursor-grab active:cursor-grabbing space-y-3'
                >
                  <div className='flex items-center justify-between'>
                    <Badge variant='outline' className={`text-[11px] font-normal px-2 py-0.5 ${task.tagColor}`}>
                      {task.tag}
                    </Badge>

                    <Button variant='ghost' size='icon' className='size-6 text-muted-foreground'>
                      <MoreVertical className='size-3' />
                    </Button>
                  </div>

                  <div>
                    <h4 className='font-semibold text-sm text-foreground leading-snug'>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className='text-xs text-muted-foreground line-clamp-2 mt-1'>
                        {task.description}
                      </p>
                    )}
                  </div>

                  <div className='flex items-center justify-between pt-2 border-t border-border/50 text-xs text-muted-foreground'>
                    <div className='flex items-center gap-3'>
                      {task.dueDate && (
                        <div className='flex items-center gap-1 text-[11px]'>
                          <Calendar className='size-3 text-muted-foreground' />
                          <span>{task.dueDate}</span>
                        </div>
                      )}

                      {task.commentsCount > 0 && (
                        <div className='flex items-center gap-1 text-[11px]'>
                          <MessageSquare className='size-3 text-muted-foreground' />
                          <span>{task.commentsCount}</span>
                        </div>
                      )}

                      {task.attachmentsCount > 0 && (
                        <div className='flex items-center gap-1 text-[11px]'>
                          <Paperclip className='size-3 text-muted-foreground' />
                          <span>{task.attachmentsCount}</span>
                        </div>
                      )}
                    </div>

                    <div className='flex -space-x-1.5 overflow-hidden'>
                      {task.assignees.map((a, idx) => (
                        <Avatar key={idx} className='size-6 ring-2 ring-card border-none'>
                          <AvatarImage src={a.avatar} />
                          <AvatarFallback className='text-[10px]'>{a.fallback}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
export default KanbanApp
