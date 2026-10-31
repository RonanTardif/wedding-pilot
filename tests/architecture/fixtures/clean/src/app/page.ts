import type { Step } from "../event-programme/domain/step";
import { InMemoryVenueRepositoryAdapter } from "../venues/adapters/outbound/in-memory-venue-repository-adapter";

export const steps: Step[] = [];
export const repository = new InMemoryVenueRepositoryAdapter([]);
