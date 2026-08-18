// Usage: requireRole("ADMIN") or requireRole("VENDOR", "ADMIN")
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "You don't have permission to do this" });
    }
    next();
  };
}

module.exports = requireRole;
