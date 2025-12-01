-- ============================================================================
-- Report 03: Revenue Trends Over Time
-- ============================================================================
-- Description: Provides monthly breakdown of revenue, total sessions, and 
--              average session price grouped by year-month.
-- ============================================================================

SELECT 
    DATE_FORMAT(sb.SessionDate, '%Y-%m') AS YearMonth,
    DATE_FORMAT(sb.SessionDate, '%Y') AS Year,
    DATE_FORMAT(sb.SessionDate, '%M %Y') AS MonthYear,
    COUNT(sb.SessionID) AS TotalSessions,
    COALESCE(SUM(sb.Price), 0.00) AS TotalRevenue,
    COALESCE(AVG(sb.Price), 0.00) AS AverageSessionPrice
FROM SessionBooking sb
WHERE sb.IsDeleted = 0
GROUP BY DATE_FORMAT(sb.SessionDate, '%Y-%m'), 
         DATE_FORMAT(sb.SessionDate, '%Y'),
         DATE_FORMAT(sb.SessionDate, '%M %Y')
ORDER BY YearMonth DESC;

