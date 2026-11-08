import { prisma } from "@/lib/db";
import { subjectInput, subjectUpdate, type SubjectInput } from "@/lib/schemas";
import { NotFoundError } from "./errors";
import { emptyCounts, progressFrom, type StatusCounts } from "./mappers";

export async function listSubjects() {
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" }, include: { decks: { select: { id: true } } } });
  const grouped = await prisma.card.groupBy({
    by: ["deckId", "status"],
    _count: { _all: true },
  });
  const deckToSubject = new Map<string, string>();
  for (const s of subjects) for (const d of s.decks) deckToSubject.set(d.id, s.id);
  const counts = new Map<string, StatusCounts>();
  for (const g of grouped) {
    const sid = deckToSubject.get(g.deckId);
    if (!sid) continue;
    const c = counts.get(sid) ?? emptyCounts();
    c[g.status as keyof StatusCounts] += g._count._all;
    counts.set(sid, c);
  }
  return subjects.map(({ decks, ...s }) => {
    const c = counts.get(s.id) ?? emptyCounts();
    return {
      ...s,
      deckCount: decks.length,
      cardCount: c.new + c.learning + c.review + c.mastered,
      statusCounts: c,
      progress: progressFrom(c),
    };
  });
}

export async function getSubject(id: string) {
  const s = await prisma.subject.findUnique({ where: { id } });
  if (!s) throw new NotFoundError("Subject", id);
  return s;
}

export async function createSubject(data: SubjectInput) {
  return prisma.subject.create({ data: subjectInput.parse(data) });
}

export async function updateSubject(id: string, data: Partial<SubjectInput>) {
  await getSubject(id);
  return prisma.subject.update({ where: { id }, data: subjectUpdate.parse(data) });
}

/** Deletes the subject; its decks are kept (they become "zonder vak"). */
export async function deleteSubject(id: string) {
  await getSubject(id);
  await prisma.subject.delete({ where: { id } });
  return { deleted: id };
}

export async function findOrCreateSubject(name: string) {
  const trimmed = name.trim();
  const existing = await prisma.subject.findFirst({ where: { name: trimmed } });
  return existing ?? prisma.subject.create({ data: { name: trimmed } });
}
