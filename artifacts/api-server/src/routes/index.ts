import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import authRouter from "./auth";
import syncRouter from "./sync";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(syncRouter);
router.use(aiRouter);

export default router;
