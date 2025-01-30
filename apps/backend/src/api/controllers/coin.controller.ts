import { FastifyRequest, FastifyReply } from "fastify";
import { trace } from "@opentelemetry/api";
import { Controller, createController } from "./base.controller";
import { CoinService } from "../../core/services/coin.service";

const coinGetAll = (coinService: CoinService) : Controller => {
  return async(req, res, span) => {
    const coins = await coinService.getAll();
    await res.send(coins);
  }
}

type CoinGetBySymbolReq = FastifyRequest<{
  Params: { symbol: string };
}>

const coinGetBySymbol = (coinService: CoinService) : Controller<CoinGetBySymbolReq> => {
  return async(req, res, span) => {
    const { symbol } = req.params;
    span.setAttribute("coin.symbol", symbol);
    const coin = await coinService.getBySymbol({ symbol });
    await res.send(coin);
  }
}

type CoinGetPriceHistoryReq = FastifyRequest<{
  Params: { symbol: string };
  Querystring: {
    from: string;
    to: string;
  };
}>

const coinGetPriceHistory = (coinService: CoinService) : Controller<CoinGetPriceHistoryReq> => {
  return async(req, res, span) => {
    const { symbol } = req.params;
    const { from, to } = req.query;
    span.setAttribute("coin.symbol", symbol);
    span.setAttribute("date.from", from);
    span.setAttribute("date.to", to);
    const history = await coinService.getPriceHistory({
      symbol,
      from: new Date(from),
      to: new Date(to)
    });
    await res.send(history);
  }
}

type CoinGetPriceStatsReq = FastifyRequest<{
  Params: { symbol: string };
  Querystring: {
    from: string;
    to: string;
  };
}>

const coinGetPriceStats = (coinService: CoinService) : Controller<CoinGetPriceStatsReq> => {
  return async(req, res, span) => {
    const { symbol } = req.params;
    const { from, to } = req.query;
    span.setAttribute("coin.symbol", symbol);
    span.setAttribute("date.from", from);
    span.setAttribute("date.to", to);
    const stats = await coinService.getPriceStats({
      symbol,
      from: new Date(from),
      to: new Date(to)
    });
    await res.send(stats);
  }
}

export function createCoinController(coinService: CoinService) {
  const tracer = trace.getTracer("coin.controller");
  return {
    getAll: createController(tracer, "coin.controller.getAll", coinGetAll(coinService)),
    getBySymbol: createController<CoinGetBySymbolReq>(tracer, "coin.controller.getBySymbol", coinGetBySymbol(coinService)),
    getPriceHistory: createController<CoinGetPriceHistoryReq>(tracer, "coin.controller.getPriceHistory", coinGetPriceHistory(coinService)),
    getPriceStats: createController<CoinGetPriceStatsReq>(tracer, "coin.controller.getPriceStats", coinGetPriceStats(coinService))
  }
}