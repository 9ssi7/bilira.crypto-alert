import { Pool } from "pg";
import { Alert, AlertType, AlertUpdateReq } from "../../core/domain/alert";
import { Tracer } from "@opentelemetry/api";
import { createRepoHandler, RepoHandler } from "./base.repository";

const mapToAlert = (row: any): Alert => {
  return {
    id: row.id,
    userId: row.user_id,
    cryptoSymbol: row.crypto_symbol,
    alertType: row.alert_type as AlertType,
    threshold: Number(row.threshold),
    timeWindow: row.time_window,
    isActive: row.is_active,
    lastTriggeredAt: row.last_triggered_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const toSnakeCase = (str: string): string => {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

const findById: RepoHandler<string, Alert | null> = async (
  pool,
  span,
  id: string
) => {
  span.setAttribute("alert.id", id);

  const result = await pool.query(`SELECT * FROM alerts WHERE id = $1`, [id]);

  return result.rows[0] ? mapToAlert(result.rows[0]) : null;
};

const findByUserId: RepoHandler<string, Alert[]> = async (
  pool,
  span,
  userId: string
) => {
  span.setAttribute("user.id", userId);

  const result = await pool.query(
    `SELECT * FROM alerts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => mapToAlert(row));
};

const findActiveAlertsBySymbol: RepoHandler<string, Alert[]> = async (
  pool,
  span,
  symbol: string
) => {
  span.setAttribute("crypto.symbol", symbol);

  const result = await pool.query(
    `SELECT * FROM alerts 
     WHERE crypto_symbol = $1 
     AND is_active = true 
     ORDER BY created_at DESC`,
    [symbol]
  );

  return result.rows.map((row) => mapToAlert(row));
};

const create: RepoHandler<
  Omit<Alert, "id" | "createdAt" | "updatedAt">,
  Alert
> = async (
  pool,
  span,
  alert: Omit<Alert, "id" | "createdAt" | "updatedAt">
) => {
  span.setAttribute("user.id", alert.userId);
  span.setAttribute("crypto.symbol", alert.cryptoSymbol);
  span.setAttribute("alert.type", alert.alertType);

  const result = await pool.query(
    `INSERT INTO alerts (
      user_id, crypto_symbol, alert_type, threshold, 
      time_window, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [
      alert.userId,
      alert.cryptoSymbol,
      alert.alertType,
      alert.threshold,
      alert.timeWindow,
      alert.isActive,
    ]
  );

  return mapToAlert(result.rows[0]);
};

const update: RepoHandler<AlertUpdateReq, Alert> = async (
  pool,
  span,
  req
) => {
  span.setAttribute("alert.id", req.id);

  const setClause = Object.entries(req.alert)
    .map(([key, _], index) => `${toSnakeCase(key)} = $${index + 2}`)
    .join(", ");

  const values = Object.values(req.alert);

  const result = await pool.query(
    `UPDATE alerts 
     SET ${setClause}
     WHERE id = $1
     RETURNING *`,
    [req.id, ...values]
  );

  if (!result.rows[0]) {
    throw new Error("Alert not found");
  }

  return mapToAlert(result.rows[0]);
};

const remove: RepoHandler<string, void> = async (pool, span, id: string) => {
  span.setAttribute("alert.id", id);

  const result = await pool.query(`DELETE FROM alerts WHERE id = $1`, [id]);

  if (result.rowCount === 0) {
    throw new Error("Alert not found");
  }
};

export function createPostgresAlertRepo(pool: Pool, tracer: Tracer) {
  return {
    findById: createRepoHandler(pool, tracer, "alert.repo.findById", findById),
    findByUserId: createRepoHandler(
      pool,
      tracer,
      "alert.repo.findByUserId",
      findByUserId
    ),
    findActiveAlertsBySymbol: createRepoHandler(
      pool,
      tracer,
      "alert.repo.findActiveAlertsBySymbol",
      findActiveAlertsBySymbol
    ),
    create: createRepoHandler(pool, tracer, "alert.repo.create", create),
    update: createRepoHandler(pool, tracer, "alert.repo.update", update),
    remove: createRepoHandler(pool, tracer, "alert.repo.remove", remove),
  };
}
