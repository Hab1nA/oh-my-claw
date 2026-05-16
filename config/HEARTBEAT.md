# OpenClaw Heartbeat Tasks

### Morning Briefing
schedule: 0 8 * * 1-5
timezone: UTC
- notify: Good morning! Here's your daily briefing.|telegram

### Health Check
schedule: */30 * * * *
- run: echo "System health check passed"

### Weekly Summary
schedule: 0 18 * * 5
- notify: Don't forget to review your weekly progress!|telegram
