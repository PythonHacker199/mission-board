const express = require('express');
const { HttpError, validateMission, PRIORITIES, STATUSES } = require('../validation');

/**
 * Every query below includes "user_id = ?" with the logged-in user's id.
 * That single rule is what guarantees a user can never read, edit or delete
 * someone else's missions — even if they guess another mission's id.
 */
function missionRoutes(db) {
  const router = express.Router();

  const getOne = db.prepare('SELECT * FROM missions WHERE id = ? AND user_id = ?');
  const insert = db.prepare(
    'INSERT INTO missions (user_id, title, description, priority, status) VALUES (?, ?, ?, ?, ?)'
  );
  const remove = db.prepare('DELETE FROM missions WHERE id = ? AND user_id = ?');

  const parseId = (raw) => {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Mission id must be a positive whole number');
    return id;
  };

  // Not-yours and doesn't-exist both return 404, so other users' ids aren't revealed.
  const findOwned = (id, userId) => {
    const mission = getOne.get(id, userId);
    if (!mission) throw new HttpError(404, 'Mission not found');
    return mission;
  };

  // GET /api/missions?status=Done&priority=High
  router.get('/', (req, res) => {
    const { status, priority } = req.query;
    if (status && !STATUSES.includes(status)) {
      throw new HttpError(400, `Status filter must be one of: ${STATUSES.join(', ')}`);
    }
    if (priority && !PRIORITIES.includes(priority)) {
      throw new HttpError(400, `Priority filter must be one of: ${PRIORITIES.join(', ')}`);
    }

    // Build the WHERE clause from fixed pieces only; user values go in as ? parameters,
    // never pasted into the SQL string, which prevents SQL injection.
    const where = ['user_id = ?'];
    const params = [req.userId];
    if (status) { where.push('status = ?'); params.push(status); }
    if (priority) { where.push('priority = ?'); params.push(priority); }

    const missions = db
      .prepare(
        `SELECT * FROM missions WHERE ${where.join(' AND ')}
         ORDER BY CASE status WHEN 'Done' THEN 1 ELSE 0 END,
                  CASE priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END,
                  created_at DESC, id DESC`
      )
      .all(...params);

    res.json({ missions });
  });

  // POST /api/missions
  router.post('/', (req, res) => {
    const error = validateMission(req.body);
    if (error) throw new HttpError(400, error);

    const { title, description = '', priority = 'Medium', status = 'To Do' } = req.body;
    const { lastInsertRowid } = insert.run(req.userId, title.trim(), description.trim(), priority, status);

    res.status(201).json({ mission: getOne.get(lastInsertRowid, req.userId) });
  });

  // GET /api/missions/:id
  router.get('/:id', (req, res) => {
    res.json({ mission: findOwned(parseId(req.params.id), req.userId) });
  });

  // PATCH /api/missions/:id  — update only the fields that are sent
  router.patch('/:id', (req, res) => {
    const id = parseId(req.params.id);
    const current = findOwned(id, req.userId);

    const error = validateMission(req.body, { partial: true });
    if (error) throw new HttpError(400, error);

    const next = {
      title: req.body.title !== undefined ? req.body.title.trim() : current.title,
      description: req.body.description !== undefined ? req.body.description.trim() : current.description,
      priority: req.body.priority ?? current.priority,
      status: req.body.status ?? current.status,
    };

    db.prepare(
      `UPDATE missions SET title = ?, description = ?, priority = ?, status = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(next.title, next.description, next.priority, next.status, id, req.userId);

    res.json({ mission: getOne.get(id, req.userId) });
  });

  // DELETE /api/missions/:id
  router.delete('/:id', (req, res) => {
    const { changes } = remove.run(parseId(req.params.id), req.userId);
    if (changes === 0) throw new HttpError(404, 'Mission not found');
    res.status(204).end();
  });

  return router;
}

module.exports = { missionRoutes };
