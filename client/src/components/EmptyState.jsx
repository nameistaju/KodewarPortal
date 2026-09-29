import { InboxIcon } from "lucide-react"

const EmptyState = ({ title = "Nothing here yet", description = "New records will appear here once they are created.", action }) => {
  return (
    <div className="empty-state">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-black/5 border border-black/10 text-black">
        <InboxIcon className="h-5 w-5" />
      </div>
      <p className="font-semibold text-black">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-neutral-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export default EmptyState
