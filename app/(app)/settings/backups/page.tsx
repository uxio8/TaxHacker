import { createPageMetadata } from "@/lib/i18n"

import BackupSettingsClient from "./backup-settings-client"

export const metadata = createPageMetadata("settings.backups")

export default function BackupSettingsPage() {
  return <BackupSettingsClient />
}
