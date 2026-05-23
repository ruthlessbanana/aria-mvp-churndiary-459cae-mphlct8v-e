/**
 * Extra Settings tabs — populated for ChurnDiary's notification preferences page.
 */

export type SettingsTab = {
  slug: string;
  label: string;
};

export const extraSettingsTabs: SettingsTab[] = [
  { slug: "notifications", label: "Notifications" },
];
