import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

const CATEGORIES = [
  { id: 'music',      label: 'Music',       description: 'Concerts, festivals, and live music events.' },
  { id: 'sports',     label: 'Sports',      description: 'Professional sports matches and tournaments.' },
  { id: 'tech',       label: 'Technology',  description: 'Tech conferences and hackathons.' },
  { id: 'food',       label: 'Food & Drink',description: 'Food festivals, wine tastings, culinary events.' },
  { id: 'art',        label: 'Art',         description: 'Exhibitions, gallery openings, installations.' },
  { id: 'comedy',     label: 'Comedy',      description: 'Stand-up comedy shows and improv nights.' },
  { id: 'theatre',    label: 'Theatre',     description: 'Plays, musicals, and opera performances.' },
  { id: 'conference', label: 'Conference',  description: 'Professional conferences and summits.' },
  { id: 'other',      label: 'Other',       description: 'Events that do not fit another category.' },
];

router.get('/', (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: CATEGORIES });
  } catch (err) {
    next(err);
  }
});

export default router;
