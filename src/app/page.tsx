import { EventRepositoryError } from "@/event-programme/application/event-repository-port";
import { createGetDayProgramme, type DayProgramme as DayProgrammeModel } from "@/event-programme/application/get-day-programme";
import { DayProgramme } from "@/event-programme/adapters/inbound/day-programme";
import { JsonEventRepositoryAdapter } from "@/event-programme/adapters/outbound/json-event-repository-adapter";

// The highlighted step depends on the current time: render on every request.
export const dynamic = "force-dynamic";

const getDayProgramme = createGetDayProgramme(new JsonEventRepositoryAdapter());

async function loadProgramme(now: Date): Promise<DayProgrammeModel | null> {
  try {
    return await getDayProgramme(now);
  } catch (error) {
    // EventRepositoryError messages hold schema paths only (no personal data); unexpected errors keep their stack.
    const details =
      error instanceof EventRepositoryError
        ? { code: error.code, message: error.message }
        : error instanceof Error
          ? { code: "UNEXPECTED", message: error.message, stack: error.stack }
          : { code: "UNEXPECTED", message: String(error) };
    console.error(JSON.stringify({ severity: "ERROR", event: "day_programme_unavailable", ...details }));
    return null;
  }
}

export default async function HomePage() {
  const programme = await loadProgramme(new Date());
  return (
    <main>
      {programme ? (
        <DayProgramme programme={programme} />
      ) : (
        <>
          <h1>Mariage</h1>
          <p role="alert">Le programme est momentanément indisponible.</p>
        </>
      )}
    </main>
  );
}
