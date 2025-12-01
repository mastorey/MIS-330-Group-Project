-- ============================================================================
-- Report 05: Room Utilization Report
-- ============================================================================
-- Description: Analyzes room utilization including total sessions assigned,
--              total hours utilized (sessions are 1 hour each), and revenue 
--              generated from room bookings.
-- ============================================================================

SELECT 
    r.RoomID,
    r.RoomNo,
    r.RoomName,
    COUNT(sb.SessionID) AS TotalSessionsAssigned,
    COUNT(sb.SessionID) AS TotalHoursUtilized,
    COALESCE(SUM(sb.Price), 0.00) AS RevenueGenerated
FROM Rooms r
LEFT JOIN SessionBooking sb ON r.RoomID = sb.RoomID AND sb.IsDeleted = 0
WHERE r.IsDeleted = 0
GROUP BY r.RoomID, r.RoomNo, r.RoomName
ORDER BY TotalSessionsAssigned DESC;

