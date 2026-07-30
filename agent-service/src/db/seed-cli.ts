import "dotenv/config";
import { getDb } from "./index.js";
import { seedIfEmpty } from "./seed.js";

// Convenience entrypoint: `npm run seed` to initialise/seed the local DB.
getDb();
seedIfEmpty();
