# Broadcasts share the same creator-side auth surface as the rest of the
# course editor — no new scopes.

from polar.course.auth import CoursesRead, CoursesWrite

__all__ = ["CoursesRead", "CoursesWrite"]
