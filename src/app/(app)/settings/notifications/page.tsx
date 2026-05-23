import { Bell } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationPreferencesForm } from "@/features/churn-diary/components/notification-preferences-form";

export const dynamic = "force-dynamic";

export default function SettingsNotificationsPage() {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
        <CardDescription>
          Control the trial watchdog reminder emails ChurnDiary sends you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationPreferencesForm />
      </CardContent>
    </Card>
  );
}
