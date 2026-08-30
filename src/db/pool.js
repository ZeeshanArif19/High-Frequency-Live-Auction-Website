import pg from "pg";
import { config } from "../config/index.js";

const { Pool } = pg;

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: config.db.poolMax,
});

// Run a connection verification query on startup
pool.query("SELECT 1")
  .then(() => {
    console.log("PostgreSQL connection pool verified successfully.");
  })
  .catch((err) => {
    console.error("PostgreSQL connection pool verification failed:", err);
  });

export { pool };
export default pool; // Export only the pool instance as requested.
