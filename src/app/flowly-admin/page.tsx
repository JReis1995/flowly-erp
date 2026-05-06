import { redirect } from 'next/navigation'

export default function FlowlyAdminEntry() {
  redirect('/login?next=/colaboradores')
}

