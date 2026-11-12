import express from "express";
import { getDashboard, getSales } from "../controllers/statsController.js";
import { authenticate, adminOnly } from "../middlewares/authenticate.js";

const router = express.Router();

router.use(authenticate, adminOnly);

router.get("/dashboard", getDashboard);
router.get("/sales", getSales);

export default router;