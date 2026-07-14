export default function StatCard({ title, value, description, icon: Icon }) {
  return (
    <div className="panel-card rounded-3xl p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="muted-text text-sm font-medium">{title}</p>
          <p className="page-title mt-3 text-3xl font-bold">{value}</p>
        </div>

        {Icon ? (
          <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
            <Icon size={22} />
          </div>
        ) : null}
      </div>

      {description ? <p className="muted-text mt-4 text-sm">{description}</p> : null}
    </div>
  )
}
