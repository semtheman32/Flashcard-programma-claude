import { listSubjects } from "@/server";
import { PageHeader } from "@/components/ui";
import { SubjectsClient } from "./subjects-client";

export default async function SubjectsPage() {
  const subjects = await listSubjects();
  return (
    <>
      <PageHeader title="Vakken" description="Groepeer je decks per vak of tentamen." />
      <SubjectsClient subjects={subjects} />
    </>
  );
}
