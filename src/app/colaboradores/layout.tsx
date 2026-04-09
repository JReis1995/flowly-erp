import DashboardLayout from '@/components/DashboardLayout'
import ColaboradoresTabs from '@/components/colaboradores/ColaboradoresTabs'

export default function ColaboradoresLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl">
        <ColaboradoresTabs />
        {children}
      </div>
    </DashboardLayout>
  )
}
