import { Tracer, Span } from "@opentelemetry/api";

export type Service<Req = any, Res = any> = (req: Req, span: Span) => Promise<Res>;

export function createService<Req = any, Res = any>(tracer: Tracer, name: string, handler: Service<Req, Res>) {
    return async (req: Req) => {
        return tracer.startActiveSpan(name, async (span) => {
            return await handler(req, span);
        });
    }
}