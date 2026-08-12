import { Router, type IRouter } from "express";
import healthRouter from "./health";
import runnersRouter from "./runners";
import racesRouter from "./races";
import resultsRouter from "./results";
import statsRouter from "./stats";
import portalRouter from "./portal";
import scraperRouter from "./scraper";
import runSignupRouter from "./runsignup";

const router: IRouter = Router();

router.use(healthRouter);
router.use(runnersRouter);
router.use(racesRouter);
router.use(resultsRouter);
router.use(statsRouter);
router.use(portalRouter);
router.use(scraperRouter);
router.use(runSignupRouter);

export default router;
