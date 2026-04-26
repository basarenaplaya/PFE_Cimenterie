import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const settingsCards = [
  {
    title: "Machine Profile",
    detail: "Packer ID: PKR-08 | Product: OPC 50kg",
  },
  {
    title: "Shift Defaults",
    detail: "Current Mode: CENTRAL | Shift Length: 8h",
  },
  {
    title: "Alert Policy",
    detail: "Critical alarms trigger operator acknowledgment within 30s.",
  },
  {
    title: "Theme",
    detail: "Use top-right toggle for light/dark mode preference.",
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <section className="dashboard-enter" style={{ animationDelay: "40ms" }}>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Dashboard Settings</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Non-persistent placeholders for now. These remain local until backend settings endpoints are ready.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 dashboard-enter" style={{ animationDelay: "120ms" }}>
        {settingsCards.map((item) => (
          <Card
            key={item.title}
            className="border-slate-200/80 bg-white/80 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70"
          >
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
