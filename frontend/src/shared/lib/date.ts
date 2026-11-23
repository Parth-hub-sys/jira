const ist = 'Asia/Kolkata'
export const shortDate = new Intl.DateTimeFormat('en-IN', {
  timeZone: ist, day: 'numeric', month: 'short',
})
export const longDate = new Intl.DateTimeFormat('en-IN', {
  timeZone: ist, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
})
const calendarDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: ist, year: 'numeric', month: '2-digit', day: '2-digit',
})

export function dueInfo(value: string) {
  const date = new Date(value)
  const today = calendarDate.format(Date.now())
  const day = calendarDate.format(date)
  const tomorrow = calendarDate.format(Date.now() + 86_400_000)
  return {
    label: day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : shortDate.format(date),
    overdue: date.getTime() < Date.now(),
  }
}
