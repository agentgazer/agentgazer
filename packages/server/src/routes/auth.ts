import { Router } from "express";

const router = Router();

router.post("/api/auth/verify", (req, res) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(401).json({ valid: false });
    return;
  }

  const expectedToken = req.app.locals.token as string;

  if (token === expectedToken) {
    res.json({ valid: true });
  } else {
    res.status(401).json({ valid: false });
  }
});

export default router;
