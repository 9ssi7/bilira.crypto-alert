import { FastifyRequest } from "fastify";
import { trace } from "@opentelemetry/api";
import { AlertService } from "../../core/services/alert.service";
import { AlertType } from "../../core/domain/alert";
import { Controller, createController } from "./base.controller";

type AlertCreateReq = FastifyRequest<{
  Body: {
    userId: string;
    cryptoSymbol: string;
    alertType: AlertType;
    threshold: number;
    timeWindow?: number;
  };
}>

const alertCreate = (alertService: AlertService) : Controller<AlertCreateReq> => {
  return async(req, res, span) => {
    const { userId, cryptoSymbol, alertType, threshold, timeWindow } =
    req.body;
  
  if (!userId || !cryptoSymbol || !alertType || threshold === undefined) {
    await res.code(400).send({
      error:
        "Missing required fields: userId, cryptoSymbol, alertType, threshold",
    });
    return;
  }
  
  if (!Object.values(AlertType).includes(alertType)) {
    await res.code(400).send({
      error: `Invalid alert type. Must be one of: ${Object.values(
        AlertType
      ).join(", ")}`,
    });
    return;
  }
  
  span.setAttribute("user.id", userId);
  span.setAttribute("crypto.symbol", cryptoSymbol);
  span.setAttribute("alert.type", alertType);
  span.setAttribute("alert.threshold", threshold);
  if (timeWindow) {
    span.setAttribute("alert.timeWindow", timeWindow);
  }
  
  const alert = await alertService.create({
    userId,
    cryptoSymbol,
    alertType,
    threshold: Number(threshold),
    timeWindow: timeWindow ? Number(timeWindow) : undefined
  });
  
  await res.code(201).send(alert);
  }
}

type AlertUpdateReq = FastifyRequest<{
  Params: { id: string };
  Body: {
    threshold?: number;
    timeWindow?: number;
    isActive?: boolean;
  };
}>

const alertUpdate = (alertService: AlertService) : Controller<AlertUpdateReq> => {
  return async(req, res, span) => {
    const { id } = req.params;
    const { threshold, timeWindow, isActive } = req.body;

    span.setAttribute("alert.id", id);

    const updates: any = {};
    if (threshold !== undefined) updates.threshold = Number(threshold);
    if (timeWindow !== undefined) updates.timeWindow = Number(timeWindow);
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    const alert = await alertService.update({ id, ...updates });
    await res.send(alert);
  }
}

type AlertDeleteReq = FastifyRequest<{
  Params: { id: string };
}>

const alertDelete = (alertService: AlertService) : Controller<AlertDeleteReq> => {
  return async(req, res, span) => {
    const { id } = req.params;  
    span.setAttribute("alert.id", id);
    await alertService.delete({ alertId: id });
    await res.code(204).send();
  }
}

type AlertGetByUserReq = FastifyRequest<{
  Params: { userId: string };
}>

const alertGetByUser = (alertService: AlertService) : Controller<AlertGetByUserReq> => {
  return async(req, res, span) => {
    const { userId } = req.params;
    span.setAttribute("user.id", userId);
    const alerts = await alertService.getByUser({ userId });
    await res.send(alerts);
  }
}

type AlertToggleStatusReq = FastifyRequest<{
  Params: { id: string };
  Body: { isActive: boolean };
}>

const alertToggleStatus = (alertService: AlertService) : Controller<AlertToggleStatusReq> => {
  return async(req, res, span) => {
    const { id } = req.params;
    const { isActive } = req.body;
    span.setAttribute("alert.id", id);
    span.setAttribute("alert.isActive", isActive);
    const alert = await alertService.toggleStatus({ alertId: id, isActive });
    await res.send(alert);
  }
}

export function createAlertController(alertService: AlertService) {
  const tracer = trace.getTracer("alert.controller");
    return {
      create: createController<AlertCreateReq>(tracer, "alert.controller.create", alertCreate(alertService)),
      update: createController<AlertUpdateReq>(tracer, "alert.controller.update", alertUpdate(alertService)),
      delete: createController<AlertDeleteReq>(tracer, "alert.controller.delete", alertDelete(alertService)),
      getByUser: createController<AlertGetByUserReq>(tracer, "alert.controller.getByUser", alertGetByUser(alertService)),
      toggleStatus: createController<AlertToggleStatusReq>(tracer, "alert.controller.toggleStatus", alertToggleStatus(alertService))
    }
}