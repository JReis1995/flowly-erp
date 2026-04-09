import type { ComponentType } from 'react'
import type { CalendarProps, Event } from 'react-big-calendar'

declare module 'react-big-calendar/lib/addons/dragAndDrop' {
  export interface EventInteractionArgs<TEvent extends object = Event> {
    event: TEvent
    start: Date
    end: Date
    allDay?: boolean
    isAllDay?: boolean
  }

  export type DragAndDropCalendarProps<TEvent extends object = Event> = CalendarProps<TEvent> & {
    onEventDrop?: (args: EventInteractionArgs<TEvent>) => void
    draggableAccessor?: (event: TEvent) => boolean
    resizableAccessor?: (event: TEvent) => boolean
    resizable?: boolean
  }

  function withDragAndDrop<TEvent extends object = Event>(
    calendar: unknown,
  ): ComponentType<DragAndDropCalendarProps<TEvent>>
  export default withDragAndDrop
}
