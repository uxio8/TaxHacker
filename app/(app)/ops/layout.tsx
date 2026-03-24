import { getCurrentUser } from "@/lib/auth"
import { canAccessPlatformOps } from "@/models/platform-admins"
import { redirect } from "next/navigation"

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  if (!(await canAccessPlatformOps(user.id))) {
    redirect("/dashboard")
  }

  return children
}
