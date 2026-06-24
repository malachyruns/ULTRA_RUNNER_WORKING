import type { Request, Response, NextFunction } from "express";

export function requireOrganizer(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.organizerId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}
