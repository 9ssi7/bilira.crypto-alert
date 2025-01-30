import { Span, Tracer } from "@opentelemetry/api";
import { FastifyReply, FastifyRequest } from "fastify";

export type Controller<Req extends FastifyRequest = FastifyRequest, Res extends FastifyReply = FastifyReply> = (req: Req, res: Res, span: Span) => Promise<void>;

export function createController<Req extends FastifyRequest = FastifyRequest, Res extends FastifyReply = FastifyReply>(tracer: Tracer, name: string, handler: Controller<Req, Res>) {
    return async (req: Req, res: Res) => {
        return tracer.startActiveSpan(name, async (span) => {
            await handler(req, res, span);
        });
    }
}