-- ============================================================================
-- Report 06: Booking Status Breakdown
-- ============================================================================
-- Description: Breaks down sessions by status (Pending, Confirmed, Completed, 
--              Cancelled) including count, total revenue, and percentages of 
--              total sessions and revenue.
-- ============================================================================

SELECT 
    sb.Status,
    COUNT(sb.SessionID) AS SessionCount,
    COALESCE(SUM(sb.Price), 0.00) AS TotalRevenue,
    ROUND((COUNT(sb.SessionID) / (SELECT COUNT(*) FROM SessionBooking WHERE IsDeleted = 0)) * 100, 2) AS PercentageOfTotalSessions,
    ROUND((COALESCE(SUM(sb.Price), 0.00) / NULLIF((SELECT COALESCE(SUM(Price), 0.00) FROM SessionBooking WHERE IsDeleted = 0), 0)) * 100, 2) AS PercentageOfTotalRevenue
FROM SessionBooking sb
WHERE sb.IsDeleted = 0
GROUP BY sb.Status
ORDER BY sb.Status;

