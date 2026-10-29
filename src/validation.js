// Input checks shared by the routes. Each function returns an error message, or null if valid.

const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['To Do', 'In Progress', 'Done'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateSignup({ name, email, password } = {}) {
  if (typeof name !== 'string' || name.trim() === '') return 'Name is required';
  if (name.trim().length > 60) return 'Name must be 60 characters or fewer';
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) return 'A valid email is required';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 72) return 'Password must be 72 characters or fewer'; // bcrypt only uses the first 72 bytes
  return null;
}

function validateLogin({ email, password } = {}) {
  if (typeof email !== 'string' || email.trim() === '') return 'Email is required';
  if (typeof password !== 'string' || password === '') return 'Password is required';
  return null;
}

/**
 * Validates mission fields.
 * partial = true is used for edits, where any field may be left out
 * but any field that IS sent must be valid.
 */
function validateMission(body = {}, { partial = false } = {}) {
  const { title, description, priority, status } = body;

  if (!partial || title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') return 'Title is required and cannot be empty';
    if (title.trim().length > 120) return 'Title must be 120 characters or fewer';
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return 'Description must be text';
    if (description.length > 1000) return 'Description must be 1000 characters or fewer';
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    return `Priority must be one of: ${PRIORITIES.join(', ')}`;
  }
  if (status !== undefined && !STATUSES.includes(status)) {
    return `Status must be one of: ${STATUSES.join(', ')}`;
  }
  if (partial && [title, description, priority, status].every((v) => v === undefined)) {
    return 'Send at least one field to update: title, description, priority or status';
  }
  return null;
}

module.exports = { HttpError, validateSignup, validateLogin, validateMission, PRIORITIES, STATUSES };
