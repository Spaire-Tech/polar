# Re-export the course-module auth deps. Challenges + submissions
# inherit the same read/write surface as the rest of the course editor
# — no new scopes needed. Keeping the import path stable from this
# module means consumers don't reach into polar.course.auth directly.

from polar.course.auth import CoursesRead, CoursesWrite

__all__ = ["CoursesRead", "CoursesWrite"]
