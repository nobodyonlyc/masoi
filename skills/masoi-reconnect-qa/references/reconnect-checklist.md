# Reconnect Checklist

## Scenarios

- Refresh in waiting room.
- Refresh during night after role assignment.
- Refresh while wolf target exists.
- Refresh after night has resolved but before discussion starts.
- Refresh during discuss.
- Refresh during vote after some votes are cast.
- Refresh on result screen.
- Disconnect one player during game and reconnect.
- All players disconnect during game; zombie room should be cleaned.
- User mapped to room that no longer exists; mapping should clear.
- Kicked user should not remain mapped to the kicked room.
- Host leaves waiting room; host transfers.
- Host clicks play again; clients wait for `room_reset`.

## Expected Resume

- Same room code.
- Same phase.
- Timer is remaining time, not full original duration.
- Own role restored.
- Wolf teammates restored for wolves.
- Current wolf target restored for wolves.
- Dead/revealed roles restored according to hidden-info rules.
- User can leave room after resume.
