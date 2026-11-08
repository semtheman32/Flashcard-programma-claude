import { getSettings } from "@/server";
import { PageHeader } from "@/components/ui";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  return (
    <>
      <PageHeader title="Instellingen" />
      <SettingsClient settings={await getSettings()} />
    </>
  );
}
