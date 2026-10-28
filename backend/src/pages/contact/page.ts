import { Router } from "express";

const router = Router();

router.get("/", (req, res) => res.render("contact", { req }));

export default router;
